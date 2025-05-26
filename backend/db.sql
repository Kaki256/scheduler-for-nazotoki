-- イベント情報を格納するテーブル
CREATE TABLE IF NOT EXISTS events (
    event_url VARCHAR(512) PRIMARY KEY,
    name VARCHAR(255) NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location_uid VARCHAR(255) NULL,
    max_participants INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL -- Add deleted_at column
);

-- ユーザーの選択情報を格納するテーブル
CREATE TABLE IF NOT EXISTS user_event_selections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    event_url VARCHAR(512) NOT NULL,
    selections_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL, -- Add deleted_at column
    UNIQUE KEY unique_user_event (username, event_url),
    FOREIGN KEY (event_url) REFERENCES events(event_url)
);