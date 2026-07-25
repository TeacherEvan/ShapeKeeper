/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as games from "../games.js";
import type * as games_draw from "../games/draw.js";
import type * as games_shared from "../games/shared.js";
import type * as games_squares from "../games/squares.js";
import type * as games_state from "../games/state.js";
import type * as rooms from "../rooms.js";
import type * as rooms_mutations from "../rooms/mutations.js";
import type * as rooms_queries from "../rooms/queries.js";
import type * as rooms_settings from "../rooms/settings.js";
import type * as rooms_shared from "../rooms/shared.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  games: typeof games;
  "games/draw": typeof games_draw;
  "games/shared": typeof games_shared;
  "games/squares": typeof games_squares;
  "games/state": typeof games_state;
  rooms: typeof rooms;
  "rooms/mutations": typeof rooms_mutations;
  "rooms/queries": typeof rooms_queries;
  "rooms/settings": typeof rooms_settings;
  "rooms/shared": typeof rooms_shared;
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
