export type Match = {
  id:number; date:string; season?:string|null; competition?:string|null; round?:string|null;
  home_team:string; away_team:string; home_score:number|null; away_score:number|null;
  stadium?:string|null; attendance?:number|null; referee?:string|null; halftime_score?:string|null; scorers?:string|null;
  possession_home?:number|null; possession_away?:number|null; shots_home?:number|null; shots_away?:number|null;
  shots_on_target_home?:number|null; shots_on_target_away?:number|null; corners_home?:number|null; corners_away?:number|null;
  fouls_home?:number|null; fouls_away?:number|null; xg_home?:number|null; xg_away?:number|null;
  completeness_level?:'BASIC'|'STANDARD'|'DETAILED'|null; has_special_events?:number|boolean; source_external_id?:string|null; external_key?:string|null; source_provider?:string|null; source_url?:string|null; last_verified_at?:string|null; kickoff_fixture_id?:number|null; bigballs_match_id?:string|null;
};

export type Season = {
  id:number; season:string; competition:string; final_position:number|null; matches:number|null;
  wins:number|null; draws:number|null; losses:number|null; goals_for:number|null; goals_against:number|null;
  points:number|null; own_goals_for?:number|null; own_goals_against?:number|null; manager:string|null; stadium?:string|null; top_scorer:string|null; top_assists:string|null; source_provider?:string|null; source_url?:string|null; last_verified_at?:string|null;
  home_record?:string|null; away_record?:string|null; api_football_league_id?:number|null;
  api_football_season_year?:number|null; top_scorer_player_id?:number|null; top_scorer_player_name?:string|null;
  top_scorer_goals?:number|null; cup_exit?:string|null; competition_result?:string|null;
  declared_only?:boolean;
};

export type Player = {
  id:number; api_football_id?:number|null; name:string; firstname?:string|null; lastname?:string|null;
  nationality:string|null; birth_date:string|null; birth_place?:string|null; birth_country?:string|null;
  age?:number|null; height?:string|null; weight?:string|null; photo_url?:string|null; position:string|null;
  shirt_number:number|null; injured?:number; appearances:number|null; starts:number|null; minutes:number|null;
  goals:number|null; own_goals?:number|null; assists:number|null; yellow_cards:number|null; red_cards:number|null; clean_sheets:number|null;
  yellow_red_cards?:number|null;
  current_squad:number; source_provider?:string|null; source_external_id?:string|null; source_url?:string|null; last_verified_at?:string|null;
  first_appearance?:string|null; last_appearance?:string|null;
};

export type PlayerSeason = {
  id:number; player_id:number; season:string; competition:string; api_football_league_id?:number|null;
  appearances:number|null; starts:number|null; minutes:number|null; shirt_number?:number|null; position?:string|null;
  rating?:number|null; captain?:number|null; substitutes_in?:number|null; substitutes_out?:number|null; substitutes_bench?:number|null;
  shots_total?:number|null; shots_on?:number|null; goals:number|null; goals_conceded?:number|null; assists:number|null;
  saves?:number|null; passes_total?:number|null; passes_key?:number|null; pass_accuracy?:number|null; tackles_total?:number|null;
  blocks?:number|null; interceptions?:number|null; duels_total?:number|null; duels_won?:number|null;
  dribbles_attempts?:number|null; dribbles_success?:number|null; fouls_drawn?:number|null; fouls_committed?:number|null;
  yellow_cards:number|null; yellow_red_cards?:number|null; red_cards:number|null; penalty_won?:number|null;
  penalty_committed?:number|null; penalty_scored?:number|null; penalty_missed?:number|null; penalty_saved?:number|null;
  clean_sheets:number|null; source_provider?:string|null; source_url?:string|null; last_verified_at?:string|null;
};

export type Standing = {
  id:number; season:string; competition:string; api_football_team_id:number; team_name:string; team_logo:string|null;
  rank:number|null; points:number|null; goals_diff:number|null; form:string|null; description:string|null; group_name:string|null;
  played:number|null; wins:number|null; draws:number|null; losses:number|null; goals_for:number|null; goals_against:number|null;
  home_played:number|null; home_wins:number|null; home_draws:number|null; home_losses:number|null;
  away_played:number|null; away_wins:number|null; away_draws:number|null; away_losses:number|null;
};

export type TeamSeasonStats = {
  season:string; competition:string; form:string|null; played:number|null; wins:number|null; draws:number|null; losses:number|null;
  goals_for:number|null; goals_against:number|null; goals_for_avg:number|null; goals_against_avg:number|null;
  clean_sheets:number|null; failed_to_score:number|null; biggest_win_home:string|null; biggest_win_away:string|null;
  biggest_loss_home:string|null; biggest_loss_away:string|null; longest_win_streak:number|null; longest_draw_streak:number|null;
  longest_loss_streak:number|null; penalties_scored:number|null; penalties_missed:number|null;
  lineups?:{formation:string;played:number}[];
};

export type Transfer = {
  id:number; player_id:number|null; api_football_player_id:number|null; player_name:string; date:string|null; type:string|null;
  direction:'IN'|'OUT'|string; from_team_id:number|null; from_team_name:string|null; from_team_logo:string|null;
  to_team_id:number|null; to_team_name:string|null; to_team_logo:string|null; season:string|null;
  source_provider?:string|null; source_url?:string|null; last_verified_at?:string|null;
  movement_type?:'TRANSFER'|'LOAN'|'RETURN'|'FREE'|'RELEASE'|string|null; session?:'SUMMER'|'WINTER'|string|null;
  fee_amount?:number|null; fee_currency?:string|null; fee_display?:string|null; identity_status?:'reconciled'|'unresolved';
};
