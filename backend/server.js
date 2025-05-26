// 必要なパッケージ: express, axios, cors, mysql2
// npm install express axios cors mysql2

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();

const dbPool = mysql.createPool({
  host: process.env.NS_MARIADB_HOSTNAME || 'localhost',
  user: process.env.NS_MARIADB_USER || 'scheduler_app_user',
  password: process.env.NS_MARIADB_PASSWORD || 'password',
  database: process.env.NS_MARIADB_DATABASE || 'schedule_app_db',
  port: process.env.NS_MARIADB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // DATE/DATETIME 型を文字列として取得
});

const PORT = process.env.PORT || 3001;

// Database setup function
async function setupDatabase() {
  const dbConfig = {
    host: process.env.NS_MARIADB_HOSTNAME || 'localhost',
    user: process.env.NS_MARIADB_USER || 'scheduler_app_user',
    password: process.env.NS_MARIADB_PASSWORD || 'password',
    database: process.env.NS_MARIADB_DATABASE || 'schedule_app_db',
    port: process.env.NS_MARIADB_PORT || 3306,
    multipleStatements: true
  };

  console.log(`[DB Setup Debug] Attempting connection with config:
    Host: ${dbConfig.host},
    Port: ${dbConfig.port},
    User: ${dbConfig.user},
    Database: ${dbConfig.database}`);

  let connection;
  try {
    console.log(`[DB Setup] Setting up database connection...`);
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: dbConfig.multipleStatements
    });
    console.log(`[DB Setup] Connected to MySQL server.`);

    console.log(`[DB Setup] Creating database "${dbConfig.database}" if it does not exist...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    console.log(`[DB Setup] Database "${dbConfig.database}" created or already exists.`);

    console.log(`[DB Setup] Using database "${dbConfig.database}"...`);
    await connection.query(`USE \`${dbConfig.database}\`;`);
    console.log(`Database '${dbConfig.database}' is ready or created.`);

    const sqlScriptPath = path.join(__dirname, 'db.sql');
    console.log(`[DB Setup] Reading SQL script from ${sqlScriptPath}...`);
    if (!fs.existsSync(sqlScriptPath)) {
      console.error(`[DB Setup] SQL script file not found: ${sqlScriptPath}`);
      throw new Error('SQL script file not found.');
    }

    const sqlScript = fs.readFileSync(sqlScriptPath, 'utf8');
    console.log('[DB Setup] Executing db.sql script...');
    await connection.query(sqlScript);
    console.log('[DB Setup] db.sql script executed successfully.');

  } catch (error) {
    console.error('[DB Setup] Error setting up database:', error);
    if (error.sqlMessage) {
        console.error('[DB Setup] SQL Error:', error.sqlMessage);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('[DB Setup] Setup connection ended.');
    }
  }
}

async function startServer() {
  try {
    await setupDatabase(); // データベースセットアップが完了するのを待つ
    // testDbConnection();

    // データベースセットアップ成功後にExpressサーバーを起動
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Database for API (dbPool) is targeting: ${process.env.NS_MARIADB_DATABASE || 'schedule_app_db'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

app.use(cors()); // 開発中は全てのオリジンを許可
app.use(express.json()); // リクエストボディのJSONをパース

app.use((req, res, next) => {
  const username =
    req.get("x-forwarded-user") ||
    req.get("x-showcase-user") ||
    null;
  req._constructedUsername = username;
  if (username) {
    console.log(`[AuthAPI] Username found in header: ${username}`);
  } else {
    console.log('[AuthAPI] Username not found in expected headers. All received headers:', JSON.stringify(req.headers, null, 2)); // pretty print
  }

  next();
});

// GET /api/get-username - ユーザー名を取得
app.get('/api/get-username', (req, res) => {
  if (req._constructedUsername) {
    console.log(`[AuthAPI] Returning username: ${req._constructedUsername}`);
    return res.json({ username: req._constructedUsername });
  } else {
    res.json({ username: null });
  }
});

// ★★★ START: Event API Endpoints ★★★

// GET all events
app.get('/api/events', async (req, res) => {
  try {
    const currentUsername = req._constructedUsername;

    const query = `
      SELECT
        e.event_url,
        e.name,
        e.start_date,
        e.end_date,
        e.location_uid,
        e.max_participants,
        (
          SELECT COUNT(DISTINCT ues.username)
          FROM user_event_selections ues
          WHERE ues.event_url = e.event_url
        ) AS submittedUsersCount,
        (
          SELECT EXISTS (
            SELECT 1
            FROM user_event_selections ues_user
            WHERE ues_user.event_url = e.event_url AND ues_user.username = ?
          )
        ) AS currentUserHasSubmittedStatus
      FROM events e
      ORDER BY e.created_at DESC
    `;

    const [rows] = await dbPool.execute(query, [currentUsername]);

    const formattedRows = rows.map(row => ({
      event_url: row.event_url,
      name: row.name,
      startDate: row.start_date || null,
      endDate: row.end_date || null,
      locationUid: row.location_uid || null,
      maxParticipants: row.max_participants,
      submittedUsersCount: parseInt(row.submittedUsersCount, 10) || 0,
      hasCurrentUserSubmittedStatus: !!row.currentUserHasSubmittedStatus
    }));
    res.json(formattedRows);
    console.log('Fetched events with submission status for user:', currentUsername, 'Formatted events:', formattedRows.length);
  } catch (dbError) {
    console.error('DB Error fetching events with submission status:', dbError);
    res.status(500).json({ error: 'データベースからのイベント一覧の取得中にエラーが発生しました。' });
  }
});

// GET a specific event by URL
app.get('/api/events/:eventUrlEncoded', async (req, res) => {
  const eventUrlEncoded = req.params.eventUrlEncoded;
  let eventUrl;
  try {
    eventUrl = decodeURIComponent(eventUrlEncoded);
    console.log('Decoded event URL:', eventUrl);
  } catch (e) {
    console.error('Error decoding event URL:', e);
    return res.status(400).json({ error: 'Invalid event URL encoding.' });
  }

  try {
    const [rows] = await dbPool.execute('SELECT event_url, name, start_date, end_date, location_uid, max_participants FROM events WHERE event_url = ?', [eventUrl]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '指定されたイベントURLが見つかりません。' });
    }
    const event = rows[0];
    res.json({
      ...event,
      startDate: event.start_date || null,
      endDate: event.end_date || null,
      locationUid: event.location_uid || null,
      maxParticipants: event.max_participants
    });
    console.log('Fetched event:', event);
  } catch (dbError) {
    console.error('DB Error fetching event:', dbError);
    res.status(500).json({ error: 'データベースからのイベント取得中にエラーが発生しました。' });
  }
});

// POST a new event
app.post('/api/events', async (req, res) => {
  const { eventUrl, name, startDate, endDate, locationUid, maxParticipants } = req.body;

  if (!eventUrl || !startDate || !endDate) {
    return res.status(400).json({ error: 'eventUrl, startDate, endDate are required fields.' });
  }

  const normalizedEventUrl = normalizeEventUrl(eventUrl); // Normalize the event URL

  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ error: '終了日は開始日以降に設定してください。' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    // Use normalizedEventUrl for database operations
    const query = 'INSERT INTO events (event_url, name, start_date, end_date, location_uid, max_participants) VALUES (?, ?, ?, ?, ?, ?)';
    await connection.execute(query, [normalizedEventUrl, name || null, startDate, endDate, locationUid || null, maxParticipants === undefined ? null : maxParticipants]);

    const [newEventRows] = await connection.execute('SELECT event_url, name, start_date, end_date, location_uid, max_participants FROM events WHERE event_url = ?', [normalizedEventUrl]);
    const newEvent = newEventRows[0];
    res.status(201).json({
        ...newEvent,
        startDate: newEvent.start_date || null,
        endDate: newEvent.end_date || null,
        locationUid: newEvent.location_uid || null,
        maxParticipants: newEvent.max_participants
    });
    console.log('Created new event with normalized URL:', newEvent);
  } catch (dbError) {
    if (connection) await connection.rollback();
    console.error('DB Error creating event:', dbError);
    if (dbError.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'このイベントURLは既に使用されています。' });
    }
    res.status(500).json({ error: 'データベースへのイベント登録中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// PUT (update) an existing event by URL
app.put('/api/events/:eventUrlEncoded', async (req, res) => {
  const eventUrlEncoded = req.params.eventUrlEncoded;
  let eventUrl;
  try {
    eventUrl = decodeURIComponent(eventUrlEncoded);
    console.log('Decoded event URL for update:', eventUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid event URL encoding.' });
  }

  const { name, startDate, endDate, maxParticipants, locationUid } = req.body; // Add maxParticipants and locationUid

  if (!startDate && !endDate && name === undefined && maxParticipants === undefined && locationUid === undefined) { // Update condition
    return res.status(400).json({ error: '更新する情報 (name, startDate, endDate, locationUid, or maxParticipants) が必要です。' });
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ error: '終了日は開始日以降に設定してください。' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    
    const fieldsToUpdate = {};
    if (name !== undefined) fieldsToUpdate.name = name;
    if (startDate) fieldsToUpdate.start_date = startDate;
    if (endDate) fieldsToUpdate.end_date = endDate;
    if (locationUid !== undefined) fieldsToUpdate.location_uid = locationUid; // Add locationUid
    if (maxParticipants !== undefined) fieldsToUpdate.max_participants = maxParticipants; // Add maxParticipants

    const fieldEntries = Object.entries(fieldsToUpdate);
    if (fieldEntries.length === 0) {
        return res.status(400).json({ error: '更新する有効なフィールドがありません。' });
    }

    const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
    const values = fieldEntries.map(([, value]) => value);
    values.push(eventUrl);

    const query = `UPDATE events SET ${setClause} WHERE event_url = ?`;
    const [result] = await connection.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '指定されたイベントURLが見つかりません。' });
    }

    const [updatedEventRows] = await connection.execute('SELECT event_url, name, start_date, end_date, location_uid, max_participants FROM events WHERE event_url = ?', [eventUrl]); // Add max_participants
    const updatedEvent = updatedEventRows[0];
    res.json({
        ...updatedEvent,
        startDate: updatedEvent.start_date || null,
        endDate: updatedEvent.end_date || null,
        locationUid: updatedEvent.location_uid || null,
        maxParticipants: updatedEvent.max_participants // Add this line
    });
    console.log('Updated event:', updatedEvent);
  } catch (dbError) {
    if (connection) await connection.rollback();
    console.error('DB Error updating event:', dbError);
    res.status(500).json({ error: 'データベースでのイベント更新中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE an event by URL
app.delete('/api/events/:eventUrlEncoded', async (req, res) => {
  const eventUrlEncoded = req.params.eventUrlEncoded;
  let eventUrl;
  try {
    eventUrl = decodeURIComponent(eventUrlEncoded);
    console.log('Decoded event URL for deletion:', eventUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid event URL encoding.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction(); // トランザクション開始

    // まず関連する user_event_selections テーブルのデータを削除
    await connection.execute('DELETE FROM user_event_selections WHERE event_url = ?', [eventUrl]);

    // 次にeventsテーブルからイベントを削除
    const [result] = await connection.execute('DELETE FROM events WHERE event_url = ?', [eventUrl]);

    if (result.affectedRows === 0) {
      // イベントが見つからなかった場合でも、user_event_selections の削除は試みている可能性があるため、
      // ここでロールバックして404を返すのが適切か、あるいは user_event_selections の削除結果に依らず204を返すか検討。
      // ここではイベント自体が見つからなければ404とする。
      await connection.rollback();
      return res.status(404).json({ error: '指定されたイベントURLが見つかりません。' });
    }

    await connection.commit(); // トランザクション確定
    res.status(204).send(); // No Content
    console.log('Deleted event and associated user_event_selections:', eventUrl);
  } catch (dbError) {
    if (connection) await connection.rollback(); // エラー時ロールバック
    console.error('DB Error deleting event and associated user_event_selections:', dbError);
    res.status(500).json({ error: 'データベースでのイベント及び関連ユーザー選択の削除中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// ★★★ END: Event API Endpoints ★★★

// Helper function to normalize event URL by removing query parameters and hash fragments
// and ensuring it ends with a trailing slash.
function normalizeEventUrl(urlString) {
  try {
    const url = new URL(urlString);
    url.search = ''; // Remove query parameters
    url.hash = '';   // Remove hash fragment
    let path = url.pathname;
    if (!path.endsWith('/')) {
      path += '/';
    }
    // Reconstruct the URL with the potentially modified path
    url.pathname = path;
    return url.toString();
  } catch (e) {
    console.error('Error normalizing URL:', urlString, e);
    // Fallback for non-URL strings or other errors:
    // If it's a simple string and doesn't have query/hash, try to append slash.
    if (typeof urlString === 'string' && !urlString.includes('?') && !urlString.includes('#')) {
      if (!urlString.endsWith('/')) {
        return urlString + '/';
      }
      return urlString;
    }
    return urlString; // Return original if complex or error
  }
}

// Helper function to fetch schedule slots from external API (similar to /api/get-schedule)
async function fetchEventSlotsForSummary(eventUrl, startDate, endDate, locationUid) {
  if (!eventUrl || !startDate || !endDate || !locationUid) {
    throw new Error('eventUrl, startDate, endDate, and locationUid are required for fetching event slots');
  }

  const urlParts = eventUrl.match(/escape\.id\/org\/([^\/]+)\/event\/([^\/]+)/);
  if (!urlParts || urlParts.length < 3) {
    throw new Error('Invalid event URL format. Could not extract orgSlug and eventSlug.');
  }
  const orgSlug = urlParts[1];
  const eventSlug = urlParts[2];

  const apiPayload = {
    orgSlug: orgSlug,
    eventSlug: eventSlug,
    dateFrom: startDate,
    dateTo: endDate,
    locationUid: locationUid,
    locationAreaUid: null
  };

  const targetApiUrl = 'https://escape.id/api/showcase/event/slots';
  console.log(`[SummaryHelper] Fetching schedule from API: ${targetApiUrl} with payload:`, JSON.stringify(apiPayload));

  try {
    const apiResponse = await axios.post(targetApiUrl, apiPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': eventUrl,
        'Origin': 'https://escape.id',
      }
    });

    const allEventTimeSlotsUTC = [];
    if (apiResponse.data && apiResponse.data.dates) {
      apiResponse.data.dates.forEach(dateEntry => {
        if (dateEntry.slots) {
          dateEntry.slots.forEach(slot => {
            allEventTimeSlotsUTC.push(slot.startAt); // Store original UTC start time
          });
        }
      });
    }
    allEventTimeSlotsUTC.sort(); // Ensure chronological order
    return allEventTimeSlotsUTC;
  } catch (error) {
    console.error(`[SummaryHelper] Error fetching schedule from API ${targetApiUrl}:`, error.message);
    if (error.response) {
      console.error('[SummaryHelper] API Error Response Status:', error.response.status);
      console.error('[SummaryHelper] API Error Response Data:', error.response.data);
    }
    throw new Error('Failed to fetch event slots from external API for summary.');
  }
}


// GET /api/events/:eventUrlEncoded/summary - イベントの出欠集計情報を取得
app.get('/api/events/:eventUrlEncoded/summary', async (req, res) => {
  const eventUrlEncoded = req.params.eventUrlEncoded;
  let eventUrl;
  try {
    eventUrl = decodeURIComponent(eventUrlEncoded);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid event URL encoding.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // 1. イベント基本情報を取得 (name, start_date, end_date, location_uid, max_participants)
    const [eventRows] = await connection.execute('SELECT name, start_date, end_date, location_uid, max_participants FROM events WHERE event_url = ?', [eventUrl]); // max_participants を追加
    if (eventRows.length === 0) {
      return res.status(404).json({ error: '指定されたイベントURLが見つかりません。' });
    }
    const eventDetails = eventRows[0];
    const eventName = eventDetails.name;
    const eventStartDate = eventDetails.start_date || null;
    const eventEndDate = eventDetails.end_date || null;
    const locationUid = eventDetails.location_uid;
    const maxParticipants = eventDetails.max_participants; // max_participants を取得

    if (!eventStartDate || !eventEndDate || !locationUid) {
        return res.status(404).json({ error: 'イベントの日付または場所情報が不足しており、集計を生成できません。' });
    }

    // 2. 外部APIからイベントの全日時スロットを取得
    const allEventTimeSlotsUTC = await fetchEventSlotsForSummary(eventUrl, eventStartDate, eventEndDate, locationUid);
    if (allEventTimeSlotsUTC.length === 0) {
        console.warn(`[SummaryAPI] No time slots returned from external API for event: ${eventUrl}`);
        // スロットがない場合でも、ユーザー選択は空かもしれないが処理は続ける
    }

    // 3. ユーザーごとの出欠情報を取得
    const [selectionRows] = await connection.execute(
      'SELECT username, selections_json FROM user_event_selections WHERE event_url = ?',
      [eventUrl]
    );

    const allUsers = [];
    const userSelectionsMap = {}; // { username: { utcDateTime: status } }

    selectionRows.forEach(row => {
      if (row.username && !allUsers.includes(row.username)) {
        allUsers.push(row.username);
      }
      try {
        let selections;
        if (typeof row.selections_json === 'string') {
          // selections_json が文字列の場合 (古いデータや異なる保存形式の場合)
          selections = JSON.parse(row.selections_json);
        } else if (typeof row.selections_json === 'object' && row.selections_json !== null) {
          // selections_json が既にオブジェクト/配列の場合 (mysql2 が JSON 型を適切にパースした場合)
          selections = row.selections_json;
        } else {
          // null やその他の予期しない型の場合
          console.warn(`[SummaryAPI] selections_json for user ${row.username}, event ${eventUrl} is not a string or valid object:`, row.selections_json);
          selections = []; // デフォルトとして空配列を扱う
        }

        if (Array.isArray(selections)) {
          if (!userSelectionsMap[row.username]) {
            userSelectionsMap[row.username] = {};
          }
          selections.forEach(sel => {
            if (sel && typeof sel.event_datetime_utc === 'string' && typeof sel.status === 'string') {
              userSelectionsMap[row.username][sel.event_datetime_utc] = sel.status;
            } else {
              console.warn(`[SummaryAPI] Invalid selection item format for user ${row.username}, event ${eventUrl}:`, sel);
            }
          });
        } else {
          console.warn(`[SummaryAPI] Processed selections_json is not an array for user ${row.username}, event ${eventUrl}. Value:`, selections);
          // ユーザーマップに空のオブジェクトを確保しておく
          if (row.username && !userSelectionsMap[row.username]) {
            userSelectionsMap[row.username] = {};
          }
        }
      } catch (processError) {
        // JSON.parse の失敗、またはその他の予期せぬエラー
        console.error(`[SummaryAPI] Error processing selections_json for user ${row.username}, event ${eventUrl}:`, processError);
        // エラーが発生した場合でも、そのユーザーの選択は空として処理を続行する
        if (row.username && !userSelectionsMap[row.username]) {
            userSelectionsMap[row.username] = {};
        }
      }
    });
    allUsers.sort();

    res.json({
      eventName: eventName || extractEventNameFromUrl(eventUrl),
      eventStartDate,
      eventEndDate,
      maxParticipants, // レスポンスに追加
      allEventTimeSlotsUTC,
      allUsers,
      userSelectionsMap
    });
    console.log(`[SummaryAPI] Successfully generated summary for event: ${eventUrl}`);

  } catch (error) {
    console.error(`[SummaryAPI] Error generating summary for event ${eventUrl}:`, error);
    res.status(500).json({ error: 'イベント集計の生成中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// URLからイベント名を抽出する簡単なヘルパー (server.js内でのみ使用)
function extractEventNameFromUrl(url) {
  try {
    const pathSegments = new URL(url).pathname.split('/');
    const eventSegment = pathSegments.filter(Boolean).pop();
    if (eventSegment) {
      return eventSegment.replace(/-/g, ' ').replace(/_/g, ' ');
    }
    return 'イベント';
  } catch (e) {
    return 'イベント';
  }
}

// --- スケジュール関連のエンドポイント ---

// POST /api/get-schedule - スケジュール取得 (ペイロードでパラメータを受け取る)
app.post('/api/get-schedule', async (req, res) => {
  const { event_url, date_from, date_to, location_uid } = req.body; // req.query から req.body に変更

  if (!event_url || !date_from || !date_to || !location_uid) {
    return res.status(400).json({ error: 'event_url, date_from, date_to, location_uid are required in the request body.' }); // エラーメッセージを更新
  }

  const urlParts = event_url.match(/escape\.id\/org\/([^\/]+)\/event\/([^\/]+)/);
  if (!urlParts || urlParts.length < 3) {
    console.error('[API /get-schedule] Invalid event_url format:', event_url);
    return res.status(400).json({ error: 'Invalid event_url format. Could not extract orgSlug and eventSlug.' });
  }
  const orgSlug = urlParts[1];
  const eventSlug = urlParts[2];

  const apiPayload = {
    orgSlug: orgSlug,
    eventSlug: eventSlug,
    dateFrom: date_from,
    dateTo: date_to,
    locationUid: location_uid, // 外部APIのペイロードに location_uid を使用
    locationAreaUid: null
  };

  const targetApiUrl = 'https://escape.id/api/showcase/event/slots';
  console.log(`[API /get-schedule] Fetching schedule from external API: ${targetApiUrl} with payload:`, JSON.stringify(apiPayload));

  try {
    const apiResponse = await axios.post(targetApiUrl, apiPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': event_url,
        'Origin': 'https://escape.id',
      }
    });

    console.log('[API /get-schedule] Successfully fetched from external API. Response status:', apiResponse.status);

    if (apiResponse.data && apiResponse.data.dates) {
        res.json(apiResponse.data);
    } else {
        console.warn('[API /get-schedule] External API response does not contain "dates" array. Data:', apiResponse.data);
        res.json({ dates: [] }); 
    }

  } catch (error) {
    console.error(`[API /get-schedule] Error fetching schedule from external API ${targetApiUrl}:`, error.message);
    if (error.response) {
      console.error('[API /get-schedule] External API Error Response Status:', error.response.status);
      console.error('[API /get-schedule] External API Error Response Data:', error.response.data);
      res.status(error.response.status || 500).json({
        error: '外部APIからのスケジュール取得中にエラーが発生しました。',
        details: error.response.data
      });
    } else if (error.request) {
      console.error('[API /get-schedule] External API No response:', error.request);
      res.status(503).json({ error: '外部APIからの応答がありません。' });
    } else {
      res.status(500).json({ error: 'スケジュールの取得処理中に内部エラーが発生しました。' });
    }
  }
});

// POST /api/save-my-status - ユーザーの選択を保存
app.post('/api/save-my-status', async (req, res) => {
  const { eventUrl, username, selections } = req.body;

  if (!eventUrl || !username || !Array.isArray(selections)) {
    return res.status(400).json({ error: 'eventUrl, username, and selections are required fields.' });
  }

  console.log('Saving user status:', {
    eventUrl,
    username,
    selections
  });

  let selectionsJsonString;
  if (typeof selections === 'string') {
    selectionsJsonString = selections;
  } else {
    selectionsJsonString = JSON.stringify(selections);
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO user_event_selections (event_url, username, selections_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE selections_json = ?`,
      [eventUrl, username, selectionsJsonString, selectionsJsonString]
    );

    await connection.commit();
    res.status(204).send();
    console.log('Saved user status for event:', eventUrl, 'user:', username);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('DB Error saving user status:', error);
    res.status(500).json({ error: '出欠状況の保存中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/load-my-status - ユーザーの選択を読み込み
app.get('/api/load-my-status', async (req, res) => {
  const { username, eventUrl } = req.query;

  if (!username || !eventUrl) {
    return res.status(400).json({ error: 'username and eventUrl are required query parameters.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    const [rows] = await connection.execute(
      'SELECT selections_json FROM user_event_selections WHERE username = ? AND event_url = ?',
      [username, eventUrl]
    );
    console.log(`[API /load-my-status] Query executed for user: ${username}, event: ${eventUrl}`);
    console.log(`[API /load-my-status] Query result:`, rows);

    if (rows.length > 0) {
      const selectionsJsonValue = rows[0].selections_json;
      let selections;
      if (typeof selectionsJsonValue === 'string') {
        try {
          selections = JSON.parse(selectionsJsonValue);
        } catch (parseError) {
          console.error(`[API /load-my-status] Error parsing selections_json string for user ${username}, event ${eventUrl}:`, parseError);
          console.error(`[API /load-my-status] selections_json string was:`, selectionsJsonValue);
          return res.status(500).json({ error: '保存された選択データの形式が正しくありません (文字列パースエラー)。', details: parseError.message });
        }
      } else {
        selections = selectionsJsonValue;
      }
      res.json(selections);
    } else {
      res.json([]);
    }
    console.log(`[API /load-my-status] Loaded status for user: ${username}, event: ${eventUrl}`);
  } catch (error) {
    console.error(`[API /load-my-status] DB Error loading user status for user ${username}, event ${eventUrl}:`, error);
    if (error instanceof SyntaxError) {
        console.error(`[API /load-my-status] Malformed JSON in database for user ${username}, event ${eventUrl}. Error: ${error.message}`);
        return res.status(500).json({ error: '保存された選択データの形式が正しくありません。', details: error.message });
    }
    res.status(500).json({ error: '出欠状況の読み込み中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

app.get(/^.*$/, (req, res) => {
  if (req.path.startsWith('/api/')) { 
    return res.status(404).send('API endpoint not found'); 
  }
  res.redirect('https://nazotoki-scheduler.trap.show/');
});

const EXTERNAL_REQUEST_TIMEOUT = 10000; // 10秒のタイムアウト

// CORSミドルウェアの設定
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // フロントエンドのオリジンを許可
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.post('/api/fetch-html', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URLが必要です。' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_REQUEST_TIMEOUT);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch external URL: ${url}, Status: ${response.status}`);
      return res.status(response.status).json({ error: `外部URLの取得に失敗しました: ${response.statusText}` });
    }
    const htmlText = await response.text();
    res.json({ html: htmlText });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Request to external URL timed out: ${url}`);
      return res.status(504).json({ error: '外部URLへのリクエストがタイムアウトしました。' });
    }
    console.error(`Error fetching external URL: ${url}`, error);
    res.status(500).json({ error: '外部HTMLの取得中にサーバーエラーが発生しました。' });
  }
});

// サーバーの起動
startServer();