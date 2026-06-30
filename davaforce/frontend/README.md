# Frontend

Frontend-owned code for the combined Next.js app.

Primary locations:

- `src/app`: page implementations and frontend route components
- `src/components`: reusable UI and layout components
- `src/hooks`: browser/client hooks
- `src/lib`: frontend utilities and mock UI data

The actual Next.js route entrypoints live in `../src/app` so the project root can run one server while keeping frontend and backend ownership separate.
