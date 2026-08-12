export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://footi:footi@db:5432/footi',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  adminToken: process.env.ADMIN_TOKEN || 'footi-admin',
  judgingTimeoutMs: 180_000,
  answerTimeoutMs: 300_000,
};