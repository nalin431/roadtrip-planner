package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nalin431/roadtrip-planner/backend/internal/db/sqlc"
	"github.com/nalin431/roadtrip-planner/backend/internal/session"
)

type waypointDTO struct {
	Location string  `json:"location"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
}

type createTripRequest struct {
	Name                     string        `json:"name"`
	StartLocation            string        `json:"startLocation"`
	StartLat                 float64       `json:"startLat"`
	StartLng                 float64       `json:"startLng"`
	EndLocation              string        `json:"endLocation"`
	EndLat                   float64       `json:"endLat"`
	EndLng                   float64       `json:"endLng"`
	IsReturnTrip             bool          `json:"isReturnTrip"`
	TotalDays                int           `json:"totalDays"`
	MaxDrivingHoursPerDay    float64       `json:"maxDrivingHoursPerDay"`
	DetourBudgetPct          float64       `json:"detourBudgetPct"`
	Budget                   *float64      `json:"budget,omitempty"`
	PreferredAttractionTypes []string      `json:"preferredAttractionTypes"`
	Waypoints                []waypointDTO `json:"waypoints"`
}

type updateTripRequest struct {
	Name                     string   `json:"name"`
	TotalDays                int      `json:"totalDays"`
	MaxDrivingHoursPerDay    float64  `json:"maxDrivingHoursPerDay"`
	DetourBudgetPct          float64  `json:"detourBudgetPct"`
	Budget                   *float64 `json:"budget,omitempty"`
	PreferredAttractionTypes []string `json:"preferredAttractionTypes"`
	Status                   string   `json:"status"`
}

type tripResponse struct {
	ID                       string        `json:"id"`
	Name                     string        `json:"name"`
	StartLocation            string        `json:"startLocation"`
	StartLat                 float64       `json:"startLat"`
	StartLng                 float64       `json:"startLng"`
	EndLocation              string        `json:"endLocation"`
	EndLat                   float64       `json:"endLat"`
	EndLng                   float64       `json:"endLng"`
	IsReturnTrip             bool          `json:"isReturnTrip"`
	TotalDays                int           `json:"totalDays"`
	MaxDrivingHoursPerDay    float64       `json:"maxDrivingHoursPerDay"`
	DetourBudgetPct          float64       `json:"detourBudgetPct"`
	Budget                   *float64      `json:"budget,omitempty"`
	PreferredAttractionTypes []string      `json:"preferredAttractionTypes"`
	Status                   string        `json:"status"`
	Waypoints                []waypointDTO `json:"waypoints"`
	CreatedAt                time.Time     `json:"createdAt"`
	UpdatedAt                time.Time     `json:"updatedAt"`
}

func (s *Server) handleCreateTrip(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := session.FromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "no_session", "missing session")
		return
	}

	var req createTripRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "malformed JSON body")
		return
	}
	if req.TotalDays < 1 {
		writeError(w, http.StatusBadRequest, "invalid_total_days", "totalDays must be at least 1")
		return
	}
	if req.DetourBudgetPct <= 0 {
		req.DetourBudgetPct = 10
	}
	if req.MaxDrivingHoursPerDay <= 0 {
		req.MaxDrivingHoursPerDay = 8
	}
	if req.PreferredAttractionTypes == nil {
		req.PreferredAttractionTypes = []string{}
	}

	ctx := r.Context()
	trip, err := s.queries.CreateTrip(ctx, sqlc.CreateTripParams{
		SessionID:                sessionID,
		Name:                     req.Name,
		StartLocation:            req.StartLocation,
		StartLat:                 req.StartLat,
		StartLng:                 req.StartLng,
		EndLocation:              req.EndLocation,
		EndLat:                   req.EndLat,
		EndLng:                   req.EndLng,
		IsReturnTrip:             req.IsReturnTrip,
		TotalDays:                int32(req.TotalDays),
		MaxDrivingHoursPerDay:    pgNumeric(req.MaxDrivingHoursPerDay),
		DetourBudgetPct:          pgNumeric(req.DetourBudgetPct),
		Budget:                   pgNumericPtr(req.Budget),
		PreferredAttractionTypes: req.PreferredAttractionTypes,
	})
	if err != nil {
		s.logger.Error("create trip failed", "error", err)
		writeError(w, http.StatusInternalServerError, "create_trip_failed", "could not create trip")
		return
	}

	waypoints := make([]waypointDTO, 0, len(req.Waypoints))
	for i, wp := range req.Waypoints {
		created, err := s.queries.CreateTripWaypoint(ctx, sqlc.CreateTripWaypointParams{
			TripID:   trip.ID,
			Location: wp.Location,
			Lat:      wp.Lat,
			Lng:      wp.Lng,
			Sequence: int32(i),
		})
		if err != nil {
			s.logger.Error("create waypoint failed", "error", err)
			writeError(w, http.StatusInternalServerError, "create_waypoint_failed", "could not create waypoint")
			return
		}
		waypoints = append(waypoints, waypointDTO{Location: created.Location, Lat: created.Lat, Lng: created.Lng})
	}

	writeJSON(w, http.StatusCreated, toTripResponse(trip, waypoints))
}

func (s *Server) handleGetTrip(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTripID(w, r)
	if !ok {
		return
	}

	ctx := r.Context()
	trip, err := s.queries.GetTrip(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "trip_not_found", "trip not found")
		return
	}

	wps, err := s.queries.ListTripWaypoints(ctx, id)
	if err != nil {
		s.logger.Error("list waypoints failed", "error", err)
		writeError(w, http.StatusInternalServerError, "list_waypoints_failed", "could not load waypoints")
		return
	}

	waypoints := make([]waypointDTO, 0, len(wps))
	for _, wp := range wps {
		waypoints = append(waypoints, waypointDTO{Location: wp.Location, Lat: wp.Lat, Lng: wp.Lng})
	}

	writeJSON(w, http.StatusOK, toTripResponse(trip, waypoints))
}

func (s *Server) handleUpdateTrip(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTripID(w, r)
	if !ok {
		return
	}

	var req updateTripRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "malformed JSON body")
		return
	}
	if req.PreferredAttractionTypes == nil {
		req.PreferredAttractionTypes = []string{}
	}

	ctx := r.Context()
	trip, err := s.queries.UpdateTrip(ctx, sqlc.UpdateTripParams{
		ID:                       id,
		Name:                     req.Name,
		TotalDays:                int32(req.TotalDays),
		MaxDrivingHoursPerDay:    pgNumeric(req.MaxDrivingHoursPerDay),
		DetourBudgetPct:          pgNumeric(req.DetourBudgetPct),
		Budget:                   pgNumericPtr(req.Budget),
		PreferredAttractionTypes: req.PreferredAttractionTypes,
		Status:                   req.Status,
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "trip_not_found", "trip not found")
		return
	}

	wps, err := s.queries.ListTripWaypoints(ctx, id)
	if err != nil {
		s.logger.Error("list waypoints failed", "error", err)
		writeError(w, http.StatusInternalServerError, "list_waypoints_failed", "could not load waypoints")
		return
	}

	waypoints := make([]waypointDTO, 0, len(wps))
	for _, wp := range wps {
		waypoints = append(waypoints, waypointDTO{Location: wp.Location, Lat: wp.Lat, Lng: wp.Lng})
	}

	writeJSON(w, http.StatusOK, toTripResponse(trip, waypoints))
}

func parseTripID(w http.ResponseWriter, r *http.Request) (pgtype.UUID, bool) {
	idParam := chi.URLParam(r, "id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_trip_id", "malformed trip id")
		return pgtype.UUID{}, false
	}
	return id, true
}

func toTripResponse(trip sqlc.Trip, waypoints []waypointDTO) tripResponse {
	return tripResponse{
		ID:                       uuidString(trip.ID),
		Name:                     trip.Name,
		StartLocation:            trip.StartLocation,
		StartLat:                 trip.StartLat,
		StartLng:                 trip.StartLng,
		EndLocation:              trip.EndLocation,
		EndLat:                   trip.EndLat,
		EndLng:                   trip.EndLng,
		IsReturnTrip:             trip.IsReturnTrip,
		TotalDays:                int(trip.TotalDays),
		MaxDrivingHoursPerDay:    numericFloat(trip.MaxDrivingHoursPerDay),
		DetourBudgetPct:          numericFloat(trip.DetourBudgetPct),
		Budget:                   numericFloatPtr(trip.Budget),
		PreferredAttractionTypes: trip.PreferredAttractionTypes,
		Status:                   trip.Status,
		Waypoints:                waypoints,
		CreatedAt:                trip.CreatedAt.Time,
		UpdatedAt:                trip.UpdatedAt.Time,
	}
}
