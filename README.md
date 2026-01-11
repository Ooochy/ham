# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## 自动部署到自己的服务器（GitHub Actions）

适用场景：这是一个 Vite 构建的静态站点（产物在 `dist/`）。每次你 `git push` 到 GitHub 的 `main` 分支，会自动构建并把 `dist/` 同步到你的服务器目录。

### 1) 服务器端准备（以 Linux + Nginx 为例）

1. 创建一个用于部署的用户（可选，但推荐）：

```bash
sudo adduser deploy
sudo mkdir -p /var/www/my-app
sudo chown -R deploy:deploy /var/www/my-app
```

2. 给这个用户配置 SSH 公钥登录：

在本机生成一对专用 key（不要设置 passphrase，便于 Actions 使用）：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./github-actions-deploy
```

把公钥追加到服务器的 `~deploy/.ssh/authorized_keys`：

```bash
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy chmod 700 /home/deploy/.ssh
sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys < ./github-actions-deploy.pub
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
```

3. Nginx 配置（React Router 的 SPA 必须做“回退到 index.html”）：

示例（按你的域名与路径改）：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  root /var/www/my-app;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

然后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 2) GitHub 仓库 Secrets 配置

在 GitHub 仓库 -> Settings -> Secrets and variables -> Actions -> New repository secret，新增：

- `DEPLOY_HOST`: 服务器 IP 或域名（例如 `1.2.3.4`）
- `DEPLOY_USER`: 服务器用户名（例如 `deploy`）
- `DEPLOY_PORT`: SSH 端口（默认 `22`，如果你改过就填你自己的）
- `DEPLOY_PATH`: 服务器上用于放静态文件的目录（例如 `/var/www/my-app`）
- `DEPLOY_SSH_KEY`: 刚才生成的私钥文件内容（`github-actions-deploy` 这个文件的全文）

> 注意：`DEPLOY_SSH_KEY` 必须是“私钥”，不要填 `.pub`。

### 3) 工作流文件

仓库已包含 GitHub Actions 工作流文件：`.github/workflows/deploy.yml`。

触发规则：push 到 `main` 分支即自动部署。

### 4) 验证

1. 推送一次代码到 `main`
2. 在 GitHub -> Actions 查看 `Deploy to Server` 是否成功
3. 服务器目录下应出现 `index.html`、`assets/` 等文件

