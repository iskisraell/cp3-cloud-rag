from flask import Flask, jsonify, request, Response
import psycopg
import os
from dotenv import load_dotenv
import numpy as np
import threading
import torch
import re
import json
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
from flask_cors import CORS
import PyPDF2

app = Flask(__name__)
CORS(app, origins=["*"], allow_headers="*", supports_credentials=True)
load_dotenv()

# --- Config ---
VECTOR_DIM = 384
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

SYSTEM_PROMPT = (
    "Voce e um assistente RAG. Use apenas o CONTEXTO como base.\n"
    "Se a pergunta pedir para criar, escrever, resumir ou transformar, faca isso usando os elementos do CONTEXTO.\n"
    "Nao use conhecimento externo e nao invente fatos fora do CONTEXTO.\n"
    "Se a resposta nao estiver escrita no CONTEXTO, responda exatamente: "
    "'O documento nao contem informacoes sobre isso.'\n"
    "Para perguntas factuais, responda curto. Para pedidos criativos, seja breve e fiel ao CONTEXTO.\n"
    "Responda em portugues.\n"
)

def get_conn():
    db_host = os.getenv("DB_HOST")
    sslmode = "disable" if db_host in ("localhost", "127.0.0.1") else "require"
    conn = psycopg.connect(
        host=db_host,
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        sslmode=sslmode
    )
    return conn

# --- Embedding Model ---
embedder = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text):
    return np.array(embedder.encode([text])[0])

# --- LLM Model ---
MODEL_NAME = "Qwen/Qwen3-0.6B"
print(f"Loading {MODEL_NAME}...")
llm_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
llm_model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype="auto",
).to("cpu")
print(f"{MODEL_NAME} loaded.")

# --- Warmup ---
_models_ready = False
_warmup_started = False

def _do_warmup():
    global _models_ready
    try:
        print("Warming up embedding model...")
        get_embedding("warmup")
        print("Warming up LLM...")
        messages = [{"role": "user", "content": "Hello"}]
        text = llm_tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=False, enable_thinking=False
        )
        inputs = llm_tokenizer(text, return_tensors="pt")
        with torch.no_grad():
            llm_model.generate(**inputs, max_new_tokens=10, pad_token_id=llm_tokenizer.eos_token_id)
        _models_ready = True
        print("Model warmup complete.")
    except Exception as e:
        print(f"Warmup failed: {e}")


# --- Shared helpers ---

def build_messages(context, question, history=None):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for turn in history[-4:]:
            if turn.get('role') in ('user', 'assistant'):
                messages.append({"role": turn['role'], "content": turn['content']})
    user_msg = (
        "CONTEXTO:\n<<<\n" + context + "\n>>>\n\n"
        "PERGUNTA: " + question + "\n\n"
        "RESPOSTA EXTRAIDA DO CONTEXTO:"
    )
    messages.append({"role": "user", "content": user_msg})
    return messages


def tokenize_messages(messages):
    text = llm_tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=False, enable_thinking=False
    )
    inputs = llm_tokenizer(text, return_tensors="pt")
    max_input_tokens = 4096
    if inputs["input_ids"].shape[1] > max_input_tokens:
        inputs = {key: value[:, -max_input_tokens:] for key, value in inputs.items()}
    return inputs


def generate_answer(context, question, history=None):
    messages = build_messages(context, question, history)
    inputs = tokenize_messages(messages)

    with torch.no_grad():
        outputs = llm_model.generate(
            **inputs,
            max_new_tokens=512,
            do_sample=False,
            repetition_penalty=1.15,
            pad_token_id=llm_tokenizer.eos_token_id,
        )

    input_length = inputs["input_ids"].shape[1]
    response = llm_tokenizer.decode(outputs[0][input_length:], skip_special_tokens=True)
    response = re.sub(r"<think.*?>.*?</think\s*>", "", response, flags=re.DOTALL)
    return response.strip().strip("'\"")


def generate_stream(context, question, history=None):
    messages = build_messages(context, question, history)
    inputs = tokenize_messages(messages)

    streamer = TextIteratorStreamer(
        llm_tokenizer, skip_prompt=True, skip_special_tokens=True
    )

    generation_kwargs = {
        **inputs,
        "max_new_tokens": 512,
        "do_sample": False,
        "repetition_penalty": 1.15,
        "pad_token_id": llm_tokenizer.eos_token_id,
        "streamer": streamer,
    }

    thread = threading.Thread(target=llm_model.generate, kwargs=generation_kwargs)
    thread.start()

    for token in streamer:
        cleaned = re.sub(r"<think.*?>.*?</think\s*>", "", token, flags=re.DOTALL)
        if cleaned:
            yield cleaned
    thread.join()


def retrieve_context(question, doc_id=None):
    q_emb = get_embedding(question)
    vector_str = '[' + ','.join(str(x) for x in q_emb.tolist()) + ']'

    with get_conn() as conn:
        with conn.cursor() as cur:
            if doc_id:
                cur.execute(
                    "WITH latest_chunks AS ("
                    "SELECT DISTINCT ON (chunk_index) filename, content, chunk_index, embedding "
                    "FROM documents "
                    "WHERE filename = (SELECT filename FROM documents WHERE id = %s) "
                    "ORDER BY chunk_index, id DESC"
                    ") "
                    "SELECT filename, content, embedding <-> %s::vector AS distance "
                    "FROM latest_chunks "
                    "ORDER BY embedding <-> %s::vector ASC LIMIT 3",
                    (doc_id, vector_str, vector_str)
                )
            else:
                cur.execute(
                    "WITH latest_chunks AS ("
                    "SELECT DISTINCT ON (filename, chunk_index) filename, content, embedding "
                    "FROM documents "
                    "ORDER BY filename, chunk_index, id DESC"
                    ") "
                    "SELECT filename, content, embedding <-> %s::vector AS distance "
                    "FROM latest_chunks ORDER BY embedding <-> %s::vector ASC LIMIT 3",
                    (vector_str, vector_str)
                )
            results = cur.fetchall()

    if not results:
        return None, []

    context = "\n\n".join(r[1] for r in results)
    sources = [{'filename': r[0], 'distance': float(r[2])} for r in results]
    return context, sources


# --- Chunking ---
def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return chunks if chunks else [text]

# --- DB Init ---
def init_vector_table():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TABLE IF NOT EXISTS documents ("
                "id SERIAL PRIMARY KEY, "
                "filename TEXT, "
                "content TEXT, "
                "chunk_index INTEGER DEFAULT 0, "
                "embedding vector(" + str(VECTOR_DIM) + "));"
            )
            conn.commit()

init_vector_table()

# --- Endpoints ---

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({"message": "Hello, World!"})

@app.route('/api/ready', methods=['GET'])
def api_ready():
    global _warmup_started
    if not _warmup_started:
        _warmup_started = True
        threading.Thread(target=_do_warmup, daemon=True).start()
    if _models_ready:
        return jsonify({"models_loaded": True})
    return jsonify({"models_loaded": False}), 503

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = file.filename

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM documents WHERE filename = %s LIMIT 1", (filename,))
            if cur.fetchone():
                cur.execute("SELECT id FROM documents WHERE filename = %s ORDER BY id DESC LIMIT 1", (filename,))
                existing_id = cur.fetchone()[0]
                return jsonify({'id': existing_id, 'filename': filename})

    if filename.lower().endswith('.pdf'):
        try:
            pdf_reader = PyPDF2.PdfReader(file)
            content = "\n".join(page.extract_text() or '' for page in pdf_reader.pages)
        except Exception as e:
            return jsonify({'error': 'Erro ao ler PDF: ' + str(e)}), 400
    else:
        content = file.read().decode('utf-8')

    chunks = chunk_text(content)
    inserted_id = None
    with get_conn() as conn:
        with conn.cursor() as cur:
            for i, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                embedding = get_embedding(chunk)
                cur.execute(
                    "INSERT INTO documents (filename, content, chunk_index, embedding) "
                    "VALUES (%s, %s, %s, %s) RETURNING id",
                    (filename, chunk, i, embedding.tolist())
                )
                if inserted_id is None:
                    inserted_id = cur.fetchone()[0]
            conn.commit()

    return jsonify({'id': inserted_id, 'filename': filename})

@app.route('/documents', methods=['GET'])
def list_documents():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT ON (filename) id, filename FROM documents "
                "ORDER BY filename, id DESC"
            )
            docs = [{'id': row[0], 'filename': row[1]} for row in cur.fetchall()]
    return jsonify({'documents': docs})

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json()
    question = data.get('question')
    doc_id = data.get('doc_id')
    if not question:
        return jsonify({'error': 'No question provided'}), 400
    if not doc_id:
        return jsonify({'error': 'No document selected'}), 400
    q_emb = get_embedding(question)
    vector_str = '[' + ','.join(str(x) for x in q_emb.tolist()) + ']'
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "WITH latest_chunks AS ("
                "SELECT DISTINCT ON (chunk_index) filename, content, embedding "
                "FROM documents "
                "WHERE filename = (SELECT filename FROM documents WHERE id = %s) "
                "ORDER BY chunk_index, id DESC"
                ") "
                "SELECT filename, content, embedding <-> %s::vector AS distance "
                "FROM latest_chunks "
                "ORDER BY embedding <-> %s::vector ASC LIMIT 3",
                (doc_id, vector_str, vector_str)
            )
            results = cur.fetchall()
    docs = [
        {'filename': r[0], 'content': r[1], 'distance': float(r[2])}
        for r in results
    ]
    return jsonify({'matches': docs})

@app.route('/ask_all', methods=['POST'])
def ask_all():
    data = request.get_json()
    question = data.get('question')
    if not question:
        return jsonify({'error': 'No question provided'}), 400
    q_emb = get_embedding(question)
    vector_str = '[' + ','.join(str(x) for x in q_emb.tolist()) + ']'
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "WITH latest_chunks AS ("
                "SELECT DISTINCT ON (filename, chunk_index) filename, content, embedding "
                "FROM documents "
                "ORDER BY filename, chunk_index, id DESC"
                ") "
                "SELECT filename, content, embedding <-> %s::vector AS distance "
                "FROM latest_chunks ORDER BY embedding <-> %s::vector ASC LIMIT 3",
                (vector_str, vector_str)
            )
            results = cur.fetchall()
    docs = [
        {'filename': r[0], 'content': r[1], 'distance': float(r[2])}
        for r in results
    ]
    return jsonify({'matches': docs})

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    question = data.get('question', '')
    doc_id = data.get('doc_id')
    history = data.get('history', [])
    if not question:
        return jsonify({'error': 'No question provided'}), 400

    context, sources = retrieve_context(question, doc_id)

    if context is None:
        return jsonify({
            'answer': 'Nenhum documento encontrado para responder essa pergunta.',
            'sources': []
        })

    answer = generate_answer(context, question, history=history)
    return jsonify({'answer': answer, 'sources': sources})


@app.route('/chat/stream', methods=['POST'])
def chat_stream():
    data = request.get_json()
    question = data.get('question', '')
    doc_id = data.get('doc_id')
    history = data.get('history', [])
    if not question:
        return jsonify({'error': 'No question provided'}), 400

    context, sources = retrieve_context(question, doc_id)

    if context is None:
        def no_results():
            yield f"data: {json.dumps({'error': 'Nenhum documento encontrado.'})}\n\n"
        return Response(no_results(), mimetype='text/event-stream',
                        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})

    def event_stream():
        for token in generate_stream(context, question, history):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'done': True, 'sources': sources})}\n\n"

    return Response(event_stream(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True, use_reloader=False)
