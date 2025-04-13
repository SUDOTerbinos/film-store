-- Create users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY, -- Automatically increments integer ID
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(60) NOT NULL, -- Store hashed password (bcrypt hash length)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_favorites table (linking users to movie IDs)
CREATE TABLE user_favorites (
    favorite_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    movie_title VARCHAR(255) NOT NULL, -- Store basic info for easier display
    poster_path VARCHAR(255),       -- Store poster path
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, -- If user deleted, remove favorites
    UNIQUE (user_id, movie_id) -- Ensure a user cannot favorite the same movie twice
);

-- Create session table (for connect-pg-simple)
-- Note: Table name MUST be "session" by default for connect-pg-simple
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");