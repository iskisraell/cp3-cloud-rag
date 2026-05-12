# Frontend

Interface React do CP3 Cloud RAG.

## Rodar

```bash
bun install
bun run dev
```

## Configurar API

Crie `.env`:

```env
VITE_API_URL=http://localhost:8000
```

Em produção, use o Elastic IP ou domínio do backend.

## Build

```bash
bun run build
```

Envie `dist/` para o bucket S3 static website.
