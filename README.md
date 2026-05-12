# CP3 Cloud RAG

Assistente de IA com RAG na AWS para o CP de Cloud Computing da FIAP.

O projeto permite enviar documentos em PDF ou TXT, indexar o conteúdo em PostgreSQL com `pgvector` e conversar com o material usando um modelo local rodando em EC2. A interface foi construída com React, Vite e os tokens visuais da FIAP.

## Visão geral

**Frontend:** React + Vite, deploy estático em S3.

**Backend:** Flask + Gunicorn em EC2.

**Banco:** PostgreSQL RDS com extensão `pgvector`.

**IA:** embeddings com `all-MiniLM-L6-v2` e geração com `Qwen/Qwen3-0.6B`.

**Fluxo principal:**

1. Usuário envia um documento.
2. Backend extrai texto do PDF/TXT.
3. Texto vira chunks com overlap.
4. Cada chunk recebe embedding.
5. Pergunta do usuário vira embedding.
6. `pgvector` recupera os trechos mais próximos.
7. Qwen gera a resposta com base nos trechos recuperados.

## Estrutura

```txt
cp3-cloud-rag/
  backend/
    main.py
    requirements.txt
    .env.example
  frontend/
    src/
    package.json
    .env.example
```

## Backend

### Configurar ambiente

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Preencha `.env` com os dados do RDS:

```env
DB_HOST=seu-endpoint-rds.amazonaws.com
DB_PORT=5432
DB_NAME=ragdb
DB_USER=postgres
DB_PASSWORD=sua-senha
```

### Rodar localmente

```bash
python main.py
```

### Rodar em produção

```bash
gunicorn main:app --bind 0.0.0.0:8000 --preload --workers 1 --timeout 240
```

O backend expõe:

- `GET /api/ready`: status dos modelos.
- `POST /upload`: upload de PDF ou TXT.
- `GET /documents`: lista de documentos.
- `POST /ask`: retorna trechos similares.
- `POST /chat`: gera resposta final com RAG.

## Frontend

### Configurar ambiente

```bash
cd frontend
bun install
cp .env.example .env
```

Exemplo de `.env`:

```env
VITE_API_URL=http://44.193.237.234:8000
```

Troque pelo Elastic IP, domínio ou endpoint do backend.

### Desenvolvimento

```bash
bun run dev
```

### Build para S3

```bash
bun run build
```

Depois envie `frontend/dist/` para o bucket S3 configurado como static website.

## Decisões técnicas

**Elastic IP:** evita refazer build do frontend sempre que a EC2 reinicia.

**Qwen3 0.6B:** melhor equilíbrio entre qualidade e custo no `t3.medium`, sem depender de modelo gated.

**Thinking desativado:** reduz latência e evita mudanças de UI no MVP.

**Top 3 chunks:** limita contexto para reduzir tempo de inferência em CPU.

**Accordion de fontes:** mantém a resposta limpa e ainda mostra os trechos consultados. A similaridade é distância vetorial: quanto menor o número, mais próximo o trecho está da pergunta.

## Limitações

- Inferência em CPU tem latência perceptível.
- `t3.medium` funciona, mas não é ideal para LLM em produção.
- Para respostas mais rápidas, uma instância compute optimized, como `c7i.large`, tende a ser melhor custo-benefício.
- Para baixa latência real, o próximo salto seria GPU, com custo maior.

## Segurança

Este repositório não inclui:

- `.env` real
- chave `.pem`
- senha do RDS
- credenciais AWS

Use apenas `.env.example` como referência.
