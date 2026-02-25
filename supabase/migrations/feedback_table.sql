-- 创建 feedback 表
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 创建允许匿名用户插入数据的策略
CREATE POLICY "Allow anonymous insert" ON feedback
FOR INSERT
TO public
WITH CHECK (true);
