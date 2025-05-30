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
        e.estimated_time
        e.location_name,
        e.location_address
        (
          SELECT COUNT(DISTINCT ues.username)
          FROM user_event_selections ues
          WHERE ues.event_url = e.event_url AND ues.deleted_at IS NULL -- Exclude logically deleted selections
        ) AS submittedUsersCount,
        (
          SELECT EXISTS (
            SELECT 1
            FROM user_event_selections ues_user
            WHERE ues_user.event_url = e.event_url AND ues_user.username = ? AND ues_user.deleted_at IS NULL -- Exclude logically deleted selections
          )
        ) AS currentUserHasSubmittedStatus
      FROM events e
      WHERE e.deleted_at IS NULL -- Exclude logically deleted events
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
      estimated_time: row.estimated_time,
      location_name: row.location_name,
      location_address: row.location_address,
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
    // Modify query to exclude logically deleted events
    const [rows] = await dbPool.execute('SELECT event_url, name, start_date, end_date, location_uid, max_participants, estimated_time, location_name, location_address FROM events WHERE event_url = ? AND deleted_at IS NULL', [eventUrl]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '指定されたイベントURLが見つかりません。' });
    }
    const event = rows[0];
    res.json({
      ...event,
      startDate: event.start_date || null,
      endDate: event.end_date || null,
      locationUid: event.location_uid || null,
      maxParticipants: event.max_participants,
      estimated_time: event.estimated_time,
      location_name: event.location_name,
      location_address: event.location_address
    });
    console.log('Fetched event:', event);
  } catch (dbError) {
    console.error('DB Error fetching event:', dbError);
    res.status(500).json({ error: 'データベースからのイベント取得中にエラーが発生しました。' });
  }
});

// POST a new event
app.post('/api/events', async (req, res) => {
  const { eventUrl, name, startDate, endDate, locationUid, maxParticipants, estimatedTime, locationName, locationAddress } = req.body;

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
    await connection.beginTransaction();

    // Check if an event with the same normalizedEventUrl already exists
    const [existingEvents] = await connection.execute('SELECT event_url, deleted_at FROM events WHERE event_url = ?', [normalizedEventUrl]);

    if (existingEvents.length > 0) {
      const existingEvent = existingEvents[0];
      if (existingEvent.deleted_at !== null) {
        // Event exists but is logically deleted, so "undelete" and update it
        const updateQuery = 'UPDATE events SET name = ?, start_date = ?, end_date = ?, location_uid = ?, max_participants = ?, estimated_time = ?, location_name = ?, location_address = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE event_url = ?';
        await connection.execute(updateQuery, [
          name || null,
          startDate,
          endDate,
          locationUid || null,
          maxParticipants === undefined ? null : maxParticipants,
          estimatedTime || null, // 追加
          locationName || null,  // 追加
          locationAddress || null, // 追加
          normalizedEventUrl
        ]);
        await connection.commit();

        const [updatedEventRows] = await connection.execute('SELECT event_url, name, start_date, end_date, location_uid, max_participants, estimated_time, location_name, location_address FROM events WHERE event_url = ?', [normalizedEventUrl]);
        const updatedEvent = updatedEventRows[0];
        return res.status(200).json({ // Return 200 OK as it's an update/undelete
          ...updatedEvent,
          startDate: updatedEvent.start_date || null,
          endDate: updatedEvent.end_date || null,
          locationUid: updatedEvent.location_uid || null,
          maxParticipants: updatedEvent.max_participants,
          estimated_time: updatedEvent.estimated_time, // 追加
          location_name: updatedEvent.location_name,    // 追加
          location_address: updatedEvent.location_address // 追加
        });
      } else {
        // Event exists and is active, so it's a conflict
        await connection.rollback();
        return res.status(409).json({ error: 'このイベントURLは既に使用されています。' });
      }
    } else {
      // Event does not exist, so insert a new one
      const insertQuery = 'INSERT INTO events (event_url, name, start_date, end_date, location_uid, max_participants, estimated_time, location_name, location_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      await connection.execute(insertQuery, [normalizedEventUrl, name || null, startDate, endDate, locationUid || null, maxParticipants === undefined ? null : maxParticipants, estimatedTime || null, locationName || null, locationAddress || null]);
      await connection.commit();

      const [newEventRows] = await connection.execute('SELECT event_url, name, start_date, end_date, location_uid, max_participants, estimated_time, location_name, location_address FROM events WHERE event_url = ? AND deleted_at IS NULL', [normalizedEventUrl]);
      const newEvent = newEventRows[0];
      return res.status(201).json({
          ...newEvent,
          startDate: newEvent.start_date || null,
          endDate: newEvent.end_date || null,
          locationUid: newEvent.location_uid || null,
          maxParticipants: newEvent.max_participants,
          estimated_time: newEvent.estimated_time, // 追加
          location_name: newEvent.location_name,    // 追加
          location_address: newEvent.location_address // 追加
      });
    }
  } catch (dbError) {
    if (connection) await connection.rollback();
    console.error('DB Error processing POST /api/events:', dbError);
    // ER_DUP_ENTRY should ideally be caught by the logic above, but as a fallback:
    if (dbError.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'このイベントURLは既に使用されています。' });
    }
    res.status(500).json({ error: 'データベースへのイベント登録または更新中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// PUT (update) an existing event by URL
app.put('/api/events/:eventUrlEncoded', async (req, res) => {
  const eventUrlEncoded = req.params.eventUrlEncoded;
  let originalEventUrl;
  try {
    originalEventUrl = decodeURIComponent(eventUrlEncoded);
  } catch (e) {
    console.error('Error decoding event URL for update:', e);
    return res.status(400).json({ error: 'Invalid event URL encoding for update.' });
  }

  const { name, startDate, endDate, maxParticipants, locationUid, eventUrl: newEventUrl, estimatedTime, locationName, locationAddress } = req.body;

  // Basic validation: at least one field to update must be provided.
  if (name === undefined && startDate === undefined && endDate === undefined && maxParticipants === undefined && locationUid === undefined && newEventUrl === undefined && estimatedTime === undefined && locationName === undefined && locationAddress === undefined) {
    return res.status(400).json({ error: '更新するデータがありません。少なくとも一つのフィールドを指定してください。' });
  }
  
  // Validate date range if both are provided
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ error: '終了日は開始日以降に設定してください。' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // Check if the event to update exists and is not logically deleted
    const [existingEventRows] = await connection.execute('SELECT * FROM events WHERE event_url = ? AND deleted_at IS NULL', [originalEventUrl]);
    if (existingEventRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '更新対象のイベントが見つからないか、既に削除されています。' });
    }
    const existingEvent = existingEventRows[0];

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (startDate !== undefined) updateFields.start_date = startDate;
    if (endDate !== undefined) updateFields.end_date = endDate;
    if (maxParticipants !== undefined) updateFields.max_participants = maxParticipants === null ? null : Number(maxParticipants);
    if (locationUid !== undefined) updateFields.location_uid = locationUid;
    if (estimatedTime !== undefined) updateFields.estimated_time = estimatedTime; // 追加
    if (locationName !== undefined) updateFields.location_name = locationName;    // 追加
    if (locationAddress !== undefined) updateFields.location_address = locationAddress; // 追加
    
    let finalEventUrl = originalEventUrl;
    if (newEventUrl !== undefined && newEventUrl !== originalEventUrl) {
        const normalizedNewEventUrl = normalizeEventUrl(newEventUrl);
        // Check if the new URL already exists (and is not deleted)
        const [urlConflictRows] = await connection.execute('SELECT event_url FROM events WHERE event_url = ? AND deleted_at IS NULL', [normalizedNewEventUrl]);
        if (urlConflictRows.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: '指定された新しいイベントURLは既に使用されています。' });
        }
        updateFields.event_url = normalizedNewEventUrl;
        finalEventUrl = normalizedNewEventUrl;
    }

    if (Object.keys(updateFields).length > 0) {
        const fieldPlaceholders = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        const fieldValues = Object.values(updateFields);

        const updateQuery = `UPDATE events SET ${fieldPlaceholders} WHERE event_url = ? AND deleted_at IS NULL`;
        await connection.execute(updateQuery, [...fieldValues, originalEventUrl]);
    }
    
    // If event_url was changed, update user_event_selections as well
    if (finalEventUrl !== originalEventUrl) {
        const updateUserSelectionsQuery = 'UPDATE user_event_selections SET event_url = ? WHERE event_url = ?';
        await connection.execute(updateUserSelectionsQuery, [finalEventUrl, originalEventUrl]);
    }

    await connection.commit();

    const [updatedEventRows] = await connection.execute('SELECT event_url, name, start_date, end_date, location_uid, max_participants, estimated_time, location_name, location_address FROM events WHERE event_url = ? AND deleted_at IS NULL', [finalEventUrl]);
    if (updatedEventRows.length === 0) {
        // This case should ideally not happen if the update was successful and not a URL change to an already deleted one.
        return res.status(404).json({ error: '更新後のイベントが見つかりません。'});
    }
    const updatedEvent = updatedEventRows[0];
    
    res.json({
        ...updatedEvent,
        startDate: updatedEvent.start_date || null,
        endDate: updatedEvent.end_date || null,
        locationUid: updatedEvent.location_uid || null,
        maxParticipants: updatedEvent.max_participants,
        estimated_time: updatedEvent.estimated_time, // 追加
        location_name: updatedEvent.location_name,    // 追加
        location_address: updatedEvent.location_address // 追加
    });

  } catch (dbError) {
    if (connection) await connection.rollback();
    console.error('DB Error updating event:', dbError);
    res.status(500).json({ error: 'データベースでのイベント更新中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE (logically) an event by URL
app.delete('/api/events/:eventUrlEncoded', async (req, res) => {
  const eventUrlEncoded = req.params.eventUrlEncoded;
  let eventUrl;
  try {
    eventUrl = decodeURIComponent(eventUrlEncoded);
  } catch (e) {
    console.error('Error decoding event URL for delete:', e);
    return res.status(400).json({ error: 'Invalid event URL encoding for delete.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // Logically delete the event
    const [eventUpdateResult] = await connection.execute('UPDATE events SET deleted_at = CURRENT_TIMESTAMP WHERE event_url = ? AND deleted_at IS NULL', [eventUrl]);

    if (eventUpdateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '削除対象のイベントが見つからないか、既に削除されています。' });
    }

    // Logically delete related user_event_selections
    await connection.execute('UPDATE user_event_selections SET deleted_at = CURRENT_TIMESTAMP WHERE event_url = ? AND deleted_at IS NULL', [eventUrl]);

    await connection.commit();
    res.status(200).json({ message: 'イベントおよび関連する選択情報が論理削除されました。' });

  } catch (dbError) {
    if (connection) await connection.rollback();
    console.error('DB Error logically deleting event:', dbError);
    res.status(500).json({ error: 'データベースでのイベント論理削除中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// ★★★ END: Event API Endpoints ★★★

// ★★★ START: User Event Selections API Endpoints ★★★

// GET user's event selections for a specific event
app.get('/api/users/:username/events/:eventUrlEncoded/selections', async (req, res) => {
  const { username, eventUrlEncoded } = req.params;
  let eventUrl;
  try {
    eventUrl = decodeURIComponent(eventUrlEncoded);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid event URL encoding.' });
  }

  // First, check if the event itself is logically deleted
  try {
    const [eventRows] = await dbPool.execute('SELECT deleted_at FROM events WHERE event_url = ?', [eventUrl]);
    if (eventRows.length === 0 || eventRows[0].deleted_at) {
      return res.status(404).json({ error: 'イベントが見つからないか、削除されています。' });
    }
  } catch (dbError) {
    console.error('DB Error checking event status for selections:', dbError);
    return res.status(500).json({ error: 'イベント情報の確認中にエラーが発生しました。' });
  }

  try {
    const [rows] = await dbPool.execute(
      'SELECT selections_json FROM user_event_selections WHERE username = ? AND event_url = ? AND deleted_at IS NULL',
      [username, eventUrl]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '指定されたユーザーとイベントの組み合わせに対する選択情報が見つかりません。' });
    }
    res.json(JSON.parse(rows[0].selections_json));
  } catch (dbError) {
    console.error('DB Error fetching user event selections:', dbError);
    res.status(500).json({ error: 'データベースからのユーザー選択情報取得中にエラーが発生しました。' });
  }
});

// POST or PUT (upsert) user's event selections
app.post('/api/users/:username/events/:eventUrlEncoded/selections', async (req, res) => {
  const { username, eventUrlEncoded } = req.params;
  const { selections } = req.body;
  let eventUrl;

  try {
    eventUrl = decodeURIComponent(eventUrlEncoded);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid event URL encoding.' });
  }

  if (!selections) {
    return res.status(400).json({ error: 'selections is a required field.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // First, check if the event itself exists and is not logically deleted
    const [eventRows] = await connection.execute('SELECT event_url FROM events WHERE event_url = ? AND deleted_at IS NULL', [eventUrl]);
    if (eventRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'イベントが見つからないか、削除されています。このイベントには登録できません。' });
    }

    // Upsert logic: Try to update if exists and not deleted, otherwise insert.
    // We also undelete if it was logically deleted by setting deleted_at to NULL.
    const selectionsJson = JSON.stringify(selections);
    const upsertQuery = `
      INSERT INTO user_event_selections (username, event_url, selections_json, deleted_at)
      VALUES (?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE selections_json = ?, deleted_at = NULL
    `;
    await connection.execute(upsertQuery, [username, eventUrl, selectionsJson, selectionsJson]);
    
    await connection.commit();
    res.status(200).json({ message: 'ユーザーの選択情報が正常に保存されました。' });

  } catch (dbError) {
    if (connection) await connection.rollback();
    console.error('DB Error saving user event selections:', dbError);
    res.status(500).json({ error: 'データベースへのユーザー選択情報保存中にエラーが発生しました。' });
  } finally {
    if (connection) connection.release();
  }
});

// GET summary of event selections (for EventSummaryPage)
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

    // 1. イベント基本情報を取得 (name, start_date, end_date, location_uid, max_participants, deleted_at, estimated_time, location_name, location_address)
    const [eventRows] = await connection.execute('SELECT name, start_date, end_date, location_uid, max_participants, deleted_at, estimated_time, location_name, location_address FROM events WHERE event_url = ?', [eventUrl]);
    
    if (eventRows.length === 0) {
      return res.status(404).json({ error: '指定されたイベントURLのイベントが見つかりません。' });
    }
    const eventDetails = eventRows[0];

    if (eventDetails.deleted_at) {
      // イベントが論理削除されている場合は、サマリーを返さずに404エラーとする
      return res.status(404).json({ error: 'イベントが見つからないか、削除されています。' });
    }
    
    const eventName = eventDetails.name;
    const eventStartDate = eventDetails.start_date || null;
    const eventEndDate = eventDetails.end_date || null;
    const locationUid = eventDetails.location_uid;
    const maxParticipants = eventDetails.max_participants;
    const estimatedTime = eventDetails.estimated_time; // 追加
    const locationName = eventDetails.location_name;    // 追加
    const locationAddress = eventDetails.location_address; // 追加

    if (!eventStartDate || !eventEndDate || !locationUid) {
        console.warn(`[SummaryAPI] Event data incomplete for ${eventUrl}. Start: ${eventStartDate}, End: ${eventEndDate}, Location: ${locationUid}`);
        // 必要な情報が欠けている場合はエラー
        return res.status(404).json({ error: 'イベントの日付または場所情報が不足しており、集計を生成できません。' });
    }

    // 2. 外部APIからイベントの全日時スロットを取得
    const allEventTimeSlotsUTC = await fetchEventSlotsForSummary(eventUrl, eventStartDate, eventEndDate, locationUid);
    if (allEventTimeSlotsUTC.length === 0) {
        // スロットがない場合でも警告を出し、処理は続ける（ユーザー選択が空である可能性があるため）
        console.warn(`[SummaryAPI] No time slots returned from external API for event: ${eventUrl} between ${eventStartDate} and ${eventEndDate} for location ${locationUid}. This might be expected if the event has no slots in this period.`);
    }

    // 3. ユーザーごとの出欠情報を取得 (論理削除されていないもののみ)
    const [selectionRows] = await connection.execute(
      'SELECT username, selections_json FROM user_event_selections WHERE event_url = ? AND deleted_at IS NULL',
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
          selections = JSON.parse(row.selections_json);
        } else if (typeof row.selections_json === 'object' && row.selections_json !== null) {
          selections = row.selections_json; // Already an object/array from DB
        } else {
          console.warn(`[SummaryAPI] selections_json for user ${row.username}, event ${eventUrl} is of unexpected type or null. Value:`, row.selections_json);
          selections = null; 
        }

        // Ensure the user's map entry exists
        if (!userSelectionsMap[row.username]) {
          userSelectionsMap[row.username] = {};
        }

        if (Array.isArray(selections)) {
          // This is the expected format based on /api/save-my-status and /api/load-my-status
          // It's an array of objects: [{event_datetime_utc: "...", status: "..."}, ...]
          selections.forEach(selectionEntry => {
            if (selectionEntry && typeof selectionEntry.event_datetime_utc === 'string' && typeof selectionEntry.status === 'string') {
              userSelectionsMap[row.username][selectionEntry.event_datetime_utc] = selectionEntry.status;
            } else {
              console.warn(`[SummaryAPI] Invalid or incomplete entry in selections_json array for user ${row.username}, event ${eventUrl}. Entry:`, selectionEntry);
            }
          });
        } else if (typeof selections === 'object' && selections !== null) {
          // This handles a potential legacy format where selections_json might be an object:
          // { "YYYY-MM-DDTHH:mm:ss.sssZ": "status", ... }
          // Or if the database/parsing somehow still produces a non-array object.
          console.log(`[SummaryAPI] Processing selections_json as a direct object for user ${row.username}, event ${eventUrl}. This might be due to legacy data or an unexpected structure. Value:`, selections);
          for (const [utcDateTime, status] of Object.entries(selections)) {
            if (typeof utcDateTime === 'string' && typeof status === 'string') {
              userSelectionsMap[row.username][utcDateTime] = status;
            } else {
              console.warn(`[SummaryAPI] Invalid entry in selections_json object for user ${row.username}, event ${eventUrl}. Key: ${utcDateTime}, Value: ${status}`);
            }
          }
        } else {
          // selections is null, undefined, or not an array/object after parsing.
          // This case might occur if JSON.parse failed and returned null, or if row.selections_json was initially null/unexpected.
          console.warn(`[SummaryAPI] selections_json for user ${row.username}, event ${eventUrl} is not in a recognized format (array or object) or is null/undefined after processing. Value:`, selections);
          // userSelectionsMap[row.username] is already initialized as an empty object, so selections for this user will be empty.
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
    allUsers.sort(); // ユーザー名をソート

    res.json({
      eventName: eventName || extractEventNameFromUrl(eventUrl), // extractEventNameFromUrl は別途定義が必要
      eventStartDate,
      eventEndDate,
      maxParticipants, // レスポンスに追加
      estimatedTime, // 追加
      locationName,    // 追加
      locationAddress, // 追加
      allEventTimeSlotsUTC, // 取得した全スロット情報
      allUsers,
      userSelectionsMap
    });
    console.log(`[SummaryAPI] Successfully generated summary for event: ${eventUrl}`);

  } catch (error) {
    // このブロックでキャッチされるのは、主にDB接続エラーや予期せぬ内部エラー
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
    // 最後の空でないパスセグメントをイベント名候補とする
    const eventSegment = pathSegments.filter(Boolean).pop(); 
    if (eventSegment) {
      // URLデコードし、ハイフンやアンダースコアをスペースに置換
      return decodeURIComponent(eventSegment).replace(/-/g, ' ').replace(/_/g, ' ');
    }
    return 'イベント'; // デフォルト名
  } catch (e) {
    // URLパースエラーなどの場合
    console.warn(`[extractEventNameFromUrl] Failed to parse URL or extract name: ${url}`, e);
    return 'イベント'; // デフォルト名
  }
}

// ★★★ END: User Event Selections API Endpoints ★★★

// ★★★ START: External API Proxy (escape.id) ★★★

// POST /api/fetch-html - 外部URLからHTMLを取得
app.post('/api/fetch-html', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URLが必要です。' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_REQUEST_TIMEOUT);

    const response = await fetch(url, { signal: controller.signal }); // node-fetch を使用
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

const EXTERNAL_REQUEST_TIMEOUT = 10000; // 10秒のタイムアウト

// Helper function to fetch all event slots for the summary
async function fetchEventSlotsForSummary(eventUrl, dateFrom, dateTo, locationUid) {
  if (!eventUrl || !dateFrom || !dateTo || !locationUid) {
    console.error('[fetchEventSlotsForSummary] Missing required parameters.');
    return [];
  }

  const urlParts = eventUrl.match(/escape\.id\/org\/([^\/]+)\/event\/([^\/]+)/);
  if (!urlParts || urlParts.length < 3) {
    console.error('[fetchEventSlotsForSummary] Invalid event_url format:', eventUrl);
    return [];
  }
  const orgSlug = urlParts[1];
  const eventSlug = urlParts[2];

  const apiPayload = {
    orgSlug: orgSlug,
    eventSlug: eventSlug,
    dateFrom: dateFrom,
    dateTo: dateTo,
    locationUid: locationUid,
    locationAreaUid: null
  };

  const targetApiUrl = 'https://escape.id/api/showcase/event/slots';
  console.log(`[fetchEventSlotsForSummary] Fetching all slots from external API: ${targetApiUrl} with payload:`, JSON.stringify(apiPayload));

  try {
    const apiResponse = await axios.post(targetApiUrl, apiPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': eventUrl,
        'Origin': 'https://escape.id',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      },
      timeout: 60000
    });

    console.log('[fetchEventSlotsForSummary] Successfully fetched from external API. Response status:', apiResponse.status);
    // Log the entire API response data for inspection
    console.log('[fetchEventSlotsForSummary] API Response Data:', JSON.stringify(apiResponse.data, null, 2));

    const allSlotsUTC = [];
    if (apiResponse.data && apiResponse.data.dates && Array.isArray(apiResponse.data.dates)) {
      console.log(`[fetchEventSlotsForSummary] Processing ${apiResponse.data.dates.length} date entries.`);
      apiResponse.data.dates.forEach((dateEntry, dateIndex) => {
        console.log(`[fetchEventSlotsForSummary] Date Entry ${dateIndex}:`, JSON.stringify(dateEntry, null, 2));
        if (dateEntry.slots && Array.isArray(dateEntry.slots)) {
          console.log(`[fetchEventSlotsForSummary] Date Entry ${dateIndex} has ${dateEntry.slots.length} slots.`);
          dateEntry.slots.forEach((slot, slotIndex) => {
            // console.log(`[fetchEventSlotsForSummary] Date Entry ${dateIndex}, Slot ${slotIndex}:`, JSON.stringify(slot)); // This log seems to exist based on your output
            let dateTimeUTC = null;
            if (typeof slot === 'string') {
              dateTimeUTC = slot;
            } else if (typeof slot === 'object' && slot !== null) {
              // Added DEBUG logs to investigate slot.startAt
              if (Object.prototype.hasOwnProperty.call(slot, 'startAt')) {
                console.log(`[DEBUG] slot.startAt raw value: "${slot.startAt}", type: ${typeof slot.startAt}`);
              } else {
                console.log(`[DEBUG] slot.startAt property does not exist or is not an own property.`);
              }

              if (slot.datetime_utc) {
                dateTimeUTC = slot.datetime_utc;
                console.log('[DEBUG] Using slot.datetime_utc');
              } else if (slot.time_utc) {
                dateTimeUTC = slot.time_utc;
                console.log('[DEBUG] Using slot.time_utc');
              } else if (slot.start_utc) {
                dateTimeUTC = slot.start_utc;
                console.log('[DEBUG] Using slot.start_utc');
              } else if (slot.start_time) {
                dateTimeUTC = slot.start_time;
                console.log('[DEBUG] Using slot.start_time');
              // MODIFIED Condition for slot.startAt to be more robust
              } else if (Object.prototype.hasOwnProperty.call(slot, 'startAt') && typeof slot.startAt === 'string' && slot.startAt.length > 0) {
                dateTimeUTC = slot.startAt;
                console.log(`[DEBUG] Successfully assigned slot.startAt to dateTimeUTC. Value: "${dateTimeUTC}"`);
              } else if (slot.time) {
                dateTimeUTC = slot.time;
                console.log('[DEBUG] Using slot.time');
              } else if (slot.event_datetime_utc) {
                dateTimeUTC = slot.event_datetime_utc;
                console.log('[DEBUG] Using slot.event_datetime_utc');
              } else {
                console.log('[DEBUG] No applicable datetime property found in slot object.');
              }
            }

            if (dateTimeUTC) {
              allSlotsUTC.push(dateTimeUTC); // MODIFIED: Changed allSlots to allSlotsUTC
            } else {
              console.log('[fetchEventSlotsForSummary] Could not extract UTC datetime from slot object:', JSON.stringify(slot));
              // Add a log here if startAt was present but didn't meet the new stricter condition
              if (typeof slot === 'object' && slot !== null && Object.prototype.hasOwnProperty.call(slot, 'startAt') && !(typeof slot.startAt === 'string' && slot.startAt.length > 0)) {
                console.log(`[DEBUG] slot.startAt was present but did not meet string/length criteria. Value: "${slot.startAt}", Type: ${typeof slot.startAt}`);
              }
            }
          });
        }
      });
    }
    console.log('[fetchEventSlotsForSummary] Final extracted UTC slots:', JSON.stringify(allSlotsUTC));
    return allSlotsUTC.sort();
  } catch (error) {
    console.error(`[fetchEventSlotsForSummary] Error fetching slots from external API ${targetApiUrl}. Payload: ${JSON.stringify(apiPayload)}`);
    if (error.response) {
      console.error('[fetchEventSlotsForSummary] External API Error Response Status:', error.response.status);
      console.error('[fetchEventSlotsForSummary] External API Error Response Data:', JSON.stringify(error.response.data));
      console.error('[fetchEventSlotsForSummary] External API Error Response Headers:', JSON.stringify(error.response.headers));
    } else if (error.request) {
      console.error('[fetchEventSlotsForSummary] External API No response received. Error Code:', error.code, 'Error Message:', error.message);
    } else {
      console.error('[fetchEventSlotsForSummary] Error setting up request:', error.message);
    }
    try {
      console.error('[fetchEventSlotsForSummary] Full error object (stringified):', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch (e) {
      console.error('[fetchEventSlotsForSummary] Could not stringify full error object:', error);
    }
    return [];
  }
}

// Catch-all route - MOVED HERE to be after all specific API routes
app.get(/^.*$/, (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).send('API endpoint not found');
  }
  res.redirect('https://nazotoki-scheduler.trap.show/');
});

// Make sure this is at the end of the file, or at least after all route definitions
// サーバーの起動
startServer();