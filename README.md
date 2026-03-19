# 🧠 Dev Decision Engine

## 🚀 Descripción general

Los desarrolladores no necesitan más código generado — necesitan saber qué hacer primero.

**Dev Decision Engine** es una herramienta web que transforma errores técnicos en decisiones claras y accionables para equipos de desarrollo.

En lugar de devolver explicaciones genéricas, el sistema analiza un error y proporciona:

* Causa raíz
* Impacto en el negocio
* Nivel de prioridad
* Solución recomendada
* Próxima acción sugerida

---

## 💡 Problema

El debugging sigue siendo caótico:

* Los errores no son claros
* La priorización es manual
* El impacto en negocio es desconocido
* Los equipos pierden tiempo decidiendo qué hacer

Las herramientas actuales de IA (Copilots, ChatGPT) generan texto o código, pero **no ayudan a tomar decisiones**.

---

## 🎯 Solución

Dev Decision Engine cambia el enfoque:

👉 De *“¿qué significa este error?”*
👉 A *“¿qué debería hacer ahora?”*

Convertimos problemas técnicos en decisiones estructuradas y priorizadas.

---

## ⚙️ Funcionalidades principales

* 🧾 Análisis automático de errores (stack traces, mensajes, etc.)
* 🧠 Identificación de causa probable
* 💥 Evaluación del impacto (usuario / negocio)
* ⚡ Priorización (crítica, media, baja)
* 🛠️ Propuesta de solución clara
* 📋 Generación automática de issue lista para usar

---

## 🧪 Cómo funciona

1. El usuario introduce un error o problema
2. El sistema analiza el contexto mediante IA
3. Se genera una salida estructurada con decisiones accionables

---

## 🌐 Demo

La aplicación permite probar el sistema directamente desde el navegador, introduciendo errores reales o utilizando ejemplos predefinidos.

---

## 🛠️ Stack tecnológico (propuesto)

* Frontend: Next.js + TailwindCSS
* Backend: API Routes
* IA: OpenAI / modelos LLM
* Despliegue: Vercel

---

## 🎯 Objetivo del proyecto

Reducir el tiempo de debugging y mejorar la toma de decisiones técnicas en equipos de desarrollo.

---

## 🧩 Estado

Proyecto desarrollado como prototipo funcional para hackathon, centrado en demostrar el valor del enfoque y la experiencia de usuario.

---

## 🚀 Diferenciación

No somos otro copiloto.

👉 Generamos decisiones, no solo respuestas.


## Project setup

```bash
$ pnpm install
```

## CORS configuration

The API enables CORS for local frontend by default:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:3001`
- `http://127.0.0.1:3001`

To allow production frontend(s), set one or both environment variables:

- `FRONTEND_URL=https://your-frontend.example.com`
- `CORS_ORIGINS=https://your-frontend.example.com,https://another.example.com`

## Analyze endpoint (AI)

`POST /analyze`

Request body:

```json
{
  "repositoryUrl": "https://github.com/Lucosiar/DevDecisionEngine_Demo.git"
}
```

- `repositoryUrl` is optional. If omitted, backend uses:
  - `ANALYZE_REPOSITORY_URL` env var
  - or default `https://github.com/Lucosiar/DevDecisionEngine_Demo.git`
- `error` is optional. If omitted, backend performs repository-level analysis.

`GET /analyze/repositories`

Returns repository options for frontend selector.

Response shape is always:

```json
{
  "problem": "string",
  "cause": "string",
  "impact": "string",
  "priority": "HIGH | MEDIUM | LOW",
  "solution": "string"
}
```

Environment variables for AI integration:

- `OPENAI_API_KEY` (required to enable AI analysis)
- `OPENAI_MODEL` (optional, default: `gpt-4.1-mini`)
- `ANALYZE_REPOSITORY_URL` (optional default repo URL)
- `ANALYZE_REPOSITORIES` (optional repository catalog, comma-separated URLs)

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```
