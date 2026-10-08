/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_token from "../auth/token.js";
import type * as crons from "../crons.js";
import type * as games from "../games.js";
import type * as games_draw from "../games/draw.js";
import type * as games_lineValidation from "../games/lineValidation.js";
import type * as games_line_validation from "../games/line_validation.js";
import type * as games_shared from "../games/shared.js";
import type * as games_squares from "../games/squares.js";
import type * as games_state from "../games/state.js";
import type * as games_turn_deadline from "../games/turn_deadline.js";
import type * as games_turn_duration from "../games/turn_duration.js";
import type * as log from "../log.js";
import type * as mutations_createRoom from "../mutations/createRoom.js";
import type * as mutations_drawLine from "../mutations/drawLine.js";
import type * as mutations_joinRoom from "../mutations/joinRoom.js";
import type * as mutations_leaveRoom from "../mutations/leaveRoom.js";
import type * as mutations_startGame from "../mutations/startGame.js";
import type * as mutations_sweepAllTurnDeadlines from "../mutations/sweepAllTurnDeadlines.js";
import type * as mutations_sweepTurnDeadline from "../mutations/sweepTurnDeadline.js";
import type * as mutations_toggleReady from "../mutations/toggleReady.js";
import type * as mutations_updateGridSize from "../mutations/updateGridSize.js";
import type * as mutations_updatePartyMode from "../mutations/updatePartyMode.js";
import type * as mutations_updatePlayer from "../mutations/updatePlayer.js";
import type * as mutations_updateTurnDuration from "../mutations/updateTurnDuration.js";
import type * as queries_roomQueries from "../queries/roomQueries.js";
import type * as rate_limit from "../rate_limit.js";
import type * as rooms from "../rooms.js";
import type * as rooms_mutations from "../rooms/mutations.js";
import type * as rooms_queries from "../rooms/queries.js";
import type * as rooms_settings from "../rooms/settings.js";
import type * as rooms_shared from "../rooms/shared.js";
import type * as rooms_sharedUtils from "../rooms/sharedUtils.js";
import type * as rooms_shared_utils from "../rooms/shared_utils.js";
import type * as services_lineApplier from "../services/lineApplier.js";
import type * as services_lineResolver from "../services/lineResolver.js";
import type * as services_lineValidator from "../services/lineValidator.js";
import type * as services_multiplierGenerator from "../services/multiplierGenerator.js";
import type * as services_squareDetection from "../services/squareDetection.js";
import type * as services_triangleDetection from "../services/triangleDetection.js";
import type * as services_turnDeadlineEnforcer from "../services/turnDeadlineEnforcer.js";
import type * as utils_lineKeyNormalizer from "../utils/lineKeyNormalizer.js";
import type * as utils_roomUtils from "../utils/roomUtils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/token": typeof auth_token;
  crons: typeof crons;
  games: typeof games;
  "games/draw": typeof games_draw;
  "games/lineValidation": typeof games_lineValidation;
  "games/line_validation": typeof games_line_validation;
  "games/shared": typeof games_shared;
  "games/squares": typeof games_squares;
  "games/state": typeof games_state;
  "games/turn_deadline": typeof games_turn_deadline;
  "games/turn_duration": typeof games_turn_duration;
  log: typeof log;
  "mutations/createRoom": typeof mutations_createRoom;
  "mutations/drawLine": typeof mutations_drawLine;
  "mutations/joinRoom": typeof mutations_joinRoom;
  "mutations/leaveRoom": typeof mutations_leaveRoom;
  "mutations/startGame": typeof mutations_startGame;
  "mutations/sweepAllTurnDeadlines": typeof mutations_sweepAllTurnDeadlines;
  "mutations/sweepTurnDeadline": typeof mutations_sweepTurnDeadline;
  "mutations/toggleReady": typeof mutations_toggleReady;
  "mutations/updateGridSize": typeof mutations_updateGridSize;
  "mutations/updatePartyMode": typeof mutations_updatePartyMode;
  "mutations/updatePlayer": typeof mutations_updatePlayer;
  "mutations/updateTurnDuration": typeof mutations_updateTurnDuration;
  "queries/roomQueries": typeof queries_roomQueries;
  rate_limit: typeof rate_limit;
  rooms: typeof rooms;
  "rooms/mutations": typeof rooms_mutations;
  "rooms/queries": typeof rooms_queries;
  "rooms/settings": typeof rooms_settings;
  "rooms/shared": typeof rooms_shared;
  "rooms/sharedUtils": typeof rooms_sharedUtils;
  "rooms/shared_utils": typeof rooms_shared_utils;
  "services/lineApplier": typeof services_lineApplier;
  "services/lineResolver": typeof services_lineResolver;
  "services/lineValidator": typeof services_lineValidator;
  "services/multiplierGenerator": typeof services_multiplierGenerator;
  "services/squareDetection": typeof services_squareDetection;
  "services/triangleDetection": typeof services_triangleDetection;
  "services/turnDeadlineEnforcer": typeof services_turnDeadlineEnforcer;
  "utils/lineKeyNormalizer": typeof utils_lineKeyNormalizer;
  "utils/roomUtils": typeof utils_roomUtils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
