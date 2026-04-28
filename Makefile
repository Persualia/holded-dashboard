.PHONY: start install build preview typecheck clean

start: ## Levanta el dev server en http://localhost:5173
	@pnpm install --silent
	@pnpm dev

install: ## Instala dependencias
	@pnpm install

build: ## Build de producción a ./dist
	@pnpm build

preview: build ## Sirve el build de producción
	@pnpm preview

typecheck: ## Comprueba tipos de TypeScript
	@pnpm typecheck

clean: ## Borra dist y caches de TS/Vite
	@rm -rf dist node_modules/.vite tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo
