# Data Model

This document outlines the database schema for the application.

## `events` Table

Stores basic information about the puzzle events.

- `id` (INT, AUTO_INCREMENT, PRIMARY KEY)
- `event_url` (VARCHAR(255), UNIQUE, NOT NULL): The URL from the ticket platform.
- `name` (VARCHAR(255)): Event name.
- `start_date` (DATE)
- `end_date` (DATE)
- `location_uid` (VARCHAR(100))
- `max_participants` (INT)
- `estimated_time` (INT): Estimated duration in minutes.
- `location_name` (VARCHAR(255))
- `location_address` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP): For logical deletion.

## `user_event_selections` Table

Stores users' availability for specific events.

- `username` (VARCHAR(50)): PRIMARY KEY part 1.
- `event_url` (VARCHAR(255)): PRIMARY KEY part 2.
- `selections_json` (JSON): The availability data for time slots.
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP)
