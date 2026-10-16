export const NAV = {
  // Arrival: both conditions must be true.
  ARRIVAL_ALONG_ROUTE_M: 30,    // distance left along the road to the stop
  ARRIVAL_STRAIGHT_M: 80,       // straight-line distance to the stop

  // Off-route: you must be this far from the planned road...
  OFF_ROUTE_M: 35,
  OFF_ROUTE_FIXES: 2,           // ...for this many GPS fixes in a row (filters GPS noise)
  REROUTE_COOLDOWN_MS: 8000,    // minimum time between normal reroutes

  // Wrong-way detection
  WRONG_WAY_MIN_SPEED_MPS: 3,   // only checked above about 11 km/h
  WRONG_WAY_ANGLE_DEG: 120,     // heading this far from the road direction = wrong way
  WRONG_WAY_FIXES: 3,           // fixes in a row needed to confirm
  WRONG_WAY_REROUTE_MS: 5000,   // minimum gap before a wrong-way reroute

  MIN_SPEED_FOR_ROUTE_CHECK_MPS: 2,
  SPEED_SMOOTHING: 0.3,         // 0 to 1; higher reacts faster to speed changes

  // Rerouted roads
  REROUTE_HIGHLIGHT_MS: 60000,  // how long the purple highlight stays
  REROUTE_DIFF_M: 25,           // a road point this far from the old route counts as changed

  STEP_PASS_M: 30,              // a turn is considered passed within this distance
};