# Contributing to HOOMAAN

Thank you for your interest in contributing to HOOMAAN, an advanced 3D anatomical exploration platform and clinical simulator.

## Code of Conduct & Guidelines
We welcome contributions that improve medical accuracy, rendering performance, user accessibility, and simulation fidelity.

### Developing Locally
1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```
4. Run tests and static analysis:
   ```bash
   pnpm test
   pnpm typecheck
   ```

### Pull Requests
- Ensure all tests pass (`pnpm test`) and TypeScript checks pass (`pnpm typecheck`) before submitting.
- Write unit tests for new features and components.
- Adhere to semantic commit conventions (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- For questions and major architectural proposals, open a discussion or email `info@hoomaan.app`.

### Anatomical Data & Licensing
Anatomical meshes and structural nomenclatures in `public/anatomy/` are derived from Z-Anatomy and BodyParts3D under Creative Commons licenses (CC BY-SA 4.0 / CC BY 4.0).
