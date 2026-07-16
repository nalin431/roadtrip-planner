package main

import (
	"context"
	"log"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/nalin431/roadtrip-planner/backend/internal/api"
	"github.com/nalin431/roadtrip-planner/backend/internal/config"
	"github.com/nalin431/roadtrip-planner/backend/internal/db"
	"github.com/nalin431/roadtrip-planner/backend/internal/db/sqlc"
)

var adapter *httpadapter.HandlerAdapterV2

func init() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	logger := config.NewLogger(cfg.Env)

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db pool error: %v", err)
	}

	queries := sqlc.New(pool)
	router := api.NewRouter(logger, cfg.AllowedOrigin, queries)
	adapter = httpadapter.NewV2(router)
}

func handler(req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	return adapter.Proxy(req)
}

func main() {
	lambda.Start(handler)
}
