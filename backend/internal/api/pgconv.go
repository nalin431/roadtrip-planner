package api

import (
	"strconv"

	"github.com/jackc/pgx/v5/pgtype"
)

func pgNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	if err := n.Scan(strconv.FormatFloat(f, 'f', -1, 64)); err != nil {
		return pgtype.Numeric{Valid: false}
	}
	return n
}

func pgNumericPtr(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{Valid: false}
	}
	return pgNumeric(*f)
}

func numericFloat(n pgtype.Numeric) float64 {
	f, _ := n.Float64Value()
	return f.Float64
}

func numericFloatPtr(n pgtype.Numeric) *float64 {
	if !n.Valid {
		return nil
	}
	v := numericFloat(n)
	return &v
}

func uuidString(id pgtype.UUID) string {
	return id.String()
}
