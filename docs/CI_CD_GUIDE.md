# CI/CD Setup Guide

## Overview

Dự án này sử dụng GitHub Actions để tự động hóa các công việc:

- **Lint & Type Check**: Kiểm tra code style và TypeScript
- **Unit Tests**: Chạy unit tests với Vitest
- **Build**: Build ứng dụng production
- **E2E Tests**: Chạy E2E tests với Playwright (chỉ trên Pull Requests)

## Workflow Structure

```
.github/workflows/ci.yml
```

### Jobs

| Job          | Trigger | Dependencies     | Mô tả                     |
| ------------ | ------- | ---------------- | ------------------------- |
| `lint`       | Push/PR | -                | ESLint + TypeScript check |
| `unit-tests` | Push/PR | -                | Vitest unit tests         |
| `build`      | Push/PR | lint, unit-tests | Production build          |
| `e2e-tests`  | PR only | build            | Playwright E2E tests      |

## Setup Guide

### 1. Enable GitHub Actions

GitHub Actions được enable mặc định. Chỉ cần push code lên repository.

### 2. Setup Secrets (cho E2E tests)

Vào **Settings > Secrets and variables > Actions** và thêm:

| Secret Name     | Description                     |
| --------------- | ------------------------------- |
| `TEST_EMAIL`    | Email account để login khi test |
| `TEST_PASSWORD` | Password của test account       |

### 3. Setup Branch Protection (Recommended)

Vào **Settings > Branches > Branch protection rules** và thêm rule cho `main`:

- [x] Require status checks to pass before merging
  - [x] lint
  - [x] unit-tests
  - [x] build
- [x] Require branches to be up to date before merging

## Local Development

### Chạy lint

```bash
npm run lint
```

### Chạy type check

```bash
npx tsc --noEmit
```

### Chạy unit tests

```bash
npm test
```

### Chạy E2E tests

```bash
# Install browsers (chỉ cần lần đầu)
npx playwright install chromium

# Chạy tests
npx playwright test

# Chạy tests với UI
npx playwright test --ui

# Xem report
npx playwright show-report
```

## Troubleshooting

### Unit tests failed

1. Check console output trong GitHub Actions
2. Run `npm test` locally để debug

### E2E tests failed

1. Download artifact `playwright-report` từ GitHub Actions
2. Xem screenshot/video trong report
3. Run locally với `npx playwright test --debug`

### Build failed

1. Check TypeScript errors: `npx tsc --noEmit`
2. Check build output: `npm run build`

## Extending the Pipeline

### Add Deploy to Vercel/Netlify

Uncomment phần `deploy-preview` trong `.github/workflows/ci.yml` và setup secrets:

```yaml
VERCEL_TOKEN: xxx
VERCEL_ORG_ID: xxx
VERCEL_PROJECT_ID: xxx
```

### Add Code Coverage Badge

Thêm vào README.md:

```markdown
![Coverage](https://img.shields.io/codecov/c/github/your-username/motocare)
```

### Add Dependency Check

```yaml
- name: Check for vulnerable dependencies
  run: npm audit --audit-level=high
```

## Best Practices

1. **Commit nhỏ, rõ ràng**: Mỗi commit nên làm một việc
2. **Tạo PR cho features mới**: Không push trực tiếp vào main
3. **Fix tests trước khi merge**: Đảm bảo tất cả checks pass
4. **Review code**: Yêu cầu review từ team members
