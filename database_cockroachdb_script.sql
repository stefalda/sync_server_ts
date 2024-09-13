-- DROP SCHEMA public;

CREATE SCHEMA public AUTHORIZATION "admin";

-- DROP SEQUENCE public.characters_id_seq;

CREATE SEQUENCE public.characters_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.characters_id_seq OWNER TO stefano;
GRANT ALL ON SEQUENCE public.characters_id_seq TO root WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.characters_id_seq TO "admin" WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.characters_id_seq TO stefano WITH GRANT OPTION;

-- DROP SEQUENCE public.sync_data_id_seq;

CREATE SEQUENCE public.sync_data_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.sync_data_id_seq OWNER TO stefano;
GRANT ALL ON SEQUENCE public.sync_data_id_seq TO root WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.sync_data_id_seq TO "admin" WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.sync_data_id_seq TO stefano WITH GRANT OPTION;

-- DROP SEQUENCE public.user_clients_id_seq;

CREATE SEQUENCE public.user_clients_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.user_clients_id_seq OWNER TO stefano;
GRANT ALL ON SEQUENCE public.user_clients_id_seq TO root WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.user_clients_id_seq TO "admin" WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.user_clients_id_seq TO stefano WITH GRANT OPTION;

-- DROP SEQUENCE public.users_id_seq;

CREATE SEQUENCE public.users_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.users_id_seq OWNER TO stefano;
GRANT ALL ON SEQUENCE public.users_id_seq TO root WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.users_id_seq TO "admin" WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.users_id_seq TO stefano WITH GRANT OPTION;

-- DROP SEQUENCE public.users_id_seq1;

CREATE SEQUENCE public.users_id_seq1
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	NO CYCLE;

-- Permissions

ALTER SEQUENCE public.users_id_seq1 OWNER TO stefano;
GRANT ALL ON SEQUENCE public.users_id_seq1 TO root WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.users_id_seq1 TO "admin" WITH GRANT OPTION;
GRANT ALL ON SEQUENCE public.users_id_seq1 TO stefano WITH GRANT OPTION;
-- public."data" definition

-- Drop table

-- DROP TABLE public."data";

CREATE TABLE public.data (
	rowguid UUID NOT NULL,
	json JSONB NOT NULL,
	CONSTRAINT data_pkey PRIMARY KEY (rowguid ASC)
);

-- Permissions

ALTER TABLE public."data" OWNER TO stefano;
GRANT ALL ON TABLE public."data" TO root WITH GRANT OPTION;
GRANT ALL ON TABLE public."data" TO "admin" WITH GRANT OPTION;
GRANT ALL ON TABLE public."data" TO stefano WITH GRANT OPTION;


-- public.sync_data definition

-- Drop table

-- DROP TABLE public.sync_data;

CREATE TABLE public.sync_data (
	id INT8 NOT NULL DEFAULT unique_rowid(),
	userid UUID NOT NULL,
	clientid UUID NOT NULL,
	tablename VARCHAR(255) NOT NULL,
	rowguid UUID NOT NULL,
	operation CHAR NOT NULL,
	clientdate INT8 NOT NULL,
	serverdate INT8 NOT NULL,
	CONSTRAINT sync_data_pkey PRIMARY KEY (id ASC),
	INDEX sync_data_userid (userid ASC, serverdate ASC)
);

-- Permissions

ALTER TABLE public.sync_data OWNER TO stefano;
GRANT ALL ON TABLE public.sync_data TO root WITH GRANT OPTION;
GRANT ALL ON TABLE public.sync_data TO "admin" WITH GRANT OPTION;
GRANT ALL ON TABLE public.sync_data TO stefano WITH GRANT OPTION;


-- public.user_clients definition

-- Drop table

-- DROP TABLE public.user_clients;

CREATE TABLE public.user_clients (
	id INT8 NOT NULL DEFAULT unique_rowid(),
	clientid UUID NOT NULL,
	userid UUID NOT NULL,
	lastsync INT8 NULL,
	syncing INT8 NULL,
	clientdetails JSONB NULL,
	CONSTRAINT user_clients_pkey PRIMARY KEY (id ASC),
	UNIQUE INDEX user_clients_un (clientid ASC),
	UNIQUE INDEX user_clients_clientid_idx (clientid ASC)
);

-- Permissions

ALTER TABLE public.user_clients OWNER TO stefano;
GRANT ALL ON TABLE public.user_clients TO root WITH GRANT OPTION;
GRANT ALL ON TABLE public.user_clients TO "admin" WITH GRANT OPTION;
GRANT ALL ON TABLE public.user_clients TO stefano WITH GRANT OPTION;


-- public.user_tokens definition

-- Drop table

-- DROP TABLE public.user_tokens;

CREATE TABLE public.user_tokens (
	clientid UUID NOT NULL,
	token VARCHAR(36) NOT NULL,
	refreshtoken VARCHAR(36) NOT NULL,
	lastrefresh INT8 NULL,
	CONSTRAINT user_tokens_pkey PRIMARY KEY (clientid ASC)
);

CREATE INDEX user_tokens_token_idx ON public.user_tokens ("token");
CREATE INDEX user_tokens_refreshtoken_idx ON public.user_tokens (refreshtoken);

-- Permissions

ALTER TABLE public.user_tokens OWNER TO stefano;
GRANT ALL ON TABLE public.user_tokens TO root WITH GRANT OPTION;
GRANT ALL ON TABLE public.user_tokens TO "admin" WITH GRANT OPTION;
GRANT ALL ON TABLE public.user_tokens TO stefano WITH GRANT OPTION;


-- public."users" definition

-- Drop table

-- DROP TABLE public."users";

CREATE TABLE public.users (
	userid UUID NOT NULL,
	name VARCHAR(255) NULL,
	email VARCHAR(255) NOT NULL,
	password VARCHAR(255) NOT NULL,
	salt VARCHAR(255) NOT NULL,
	language CHAR(2) NULL,
	CONSTRAINT users_pkey PRIMARY KEY (id ASC)
);

CREATE UNIQUE INDEX users_email_idx ON public."users" (email);

-- Permissions

ALTER TABLE public."users" OWNER TO stefano;
GRANT ALL ON TABLE public."users" TO root WITH GRANT OPTION;
GRANT ALL ON TABLE public."users" TO "admin" WITH GRANT OPTION;
GRANT ALL ON TABLE public."users" TO stefano WITH GRANT OPTION;


CREATE TABLE public.users_pin (
	userid UUID NOT NULL,
	pin varchar(10) NOT NULL,
	created int8 NOT NULL,
	CONSTRAINT users_pin_pk PRIMARY KEY (userid)
);

ALTER TABLE public."users_pin" OWNER TO stefano;
GRANT ALL ON TABLE public."users_pin" TO root WITH GRANT OPTION;
GRANT ALL ON TABLE public."users_pin" TO "admin" WITH GRANT OPTION;
GRANT ALL ON TABLE public."users_pin" TO stefano WITH GRANT OPTION;


-- Permissions

GRANT ALL ON SCHEMA public TO "admin";
