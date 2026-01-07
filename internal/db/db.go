package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/go-sql-driver/mysql"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func Init(dsn string) *gorm.DB {
	if err := ensureDatabase(dsn); err != nil {
		log.Fatalf("db create failed: %v", err)
	}

	conn, err := gorm.Open(gormmysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("db open failed: %v", err)
	}

	if err := applySchema(conn, "schema.sql"); err != nil {
		log.Fatalf("db schema failed: %v", err)
	}

	return conn
}

func applySchema(conn *gorm.DB, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	statements := strings.Split(string(data), ";")
	for _, stmt := range statements {
		trimmed := strings.TrimSpace(stmt)
		if trimmed == "" {
			continue
		}
		if err := conn.Exec(trimmed).Error; err != nil {
			return err
		}
	}

	return nil
}

func ensureDatabase(dsn string) error {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return err
	}

	dbName := cfg.DBName
	if dbName == "" {
		return nil
	}

	cfg.DBName = ""
	adminDSN := cfg.FormatDSN()

	admin, err := sql.Open("mysql", adminDSN)
	if err != nil {
		return err
	}
	defer admin.Close()

	createStmt := fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
		dbName,
	)
	if _, err := admin.Exec(createStmt); err != nil {
		return err
	}

	return nil
}
