ALTER TABLE users
DROP COLUMN application_id;

ALTER TABLE users
DROP CONSTRAINT fk_users_application_id;

ALTER TABLE users
ADD COLUMN application_id UUID;

ALTER TABLE users
ADD CONSTRAINT fk_users_application_id
FOREIGN KEY (application_id)
REFERENCES applications(id);