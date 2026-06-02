import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Event, EventInput, EventStats, EventUpdate, FloorItem, FloorItemInput, FloorItemUpdate, Guest, GuestInput, GuestUpdate, HealthStatus } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListEventsUrl: () => string;
/**
 * @summary List all events
 */
export declare const listEvents: (options?: RequestInit) => Promise<Event[]>;
export declare const getListEventsQueryKey: () => readonly ["/api/events"];
export declare const getListEventsQueryOptions: <TData = Awaited<ReturnType<typeof listEvents>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listEvents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListEventsQueryResult = NonNullable<Awaited<ReturnType<typeof listEvents>>>;
export type ListEventsQueryError = ErrorType<unknown>;
/**
 * @summary List all events
 */
export declare function useListEvents<TData = Awaited<ReturnType<typeof listEvents>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateEventUrl: () => string;
/**
 * @summary Create a new event
 */
export declare const createEvent: (eventInput: EventInput, options?: RequestInit) => Promise<Event>;
export declare const getCreateEventMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEvent>>, TError, {
        data: BodyType<EventInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createEvent>>, TError, {
    data: BodyType<EventInput>;
}, TContext>;
export type CreateEventMutationResult = NonNullable<Awaited<ReturnType<typeof createEvent>>>;
export type CreateEventMutationBody = BodyType<EventInput>;
export type CreateEventMutationError = ErrorType<unknown>;
/**
* @summary Create a new event
*/
export declare const useCreateEvent: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEvent>>, TError, {
        data: BodyType<EventInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createEvent>>, TError, {
    data: BodyType<EventInput>;
}, TContext>;
export declare const getGetEventUrl: (eventId: number) => string;
/**
 * @summary Get event by ID
 */
export declare const getEvent: (eventId: number, options?: RequestInit) => Promise<Event>;
export declare const getGetEventQueryKey: (eventId: number) => readonly [`/api/events/${number}`];
export declare const getGetEventQueryOptions: <TData = Awaited<ReturnType<typeof getEvent>>, TError = ErrorType<void>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEvent>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getEvent>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetEventQueryResult = NonNullable<Awaited<ReturnType<typeof getEvent>>>;
export type GetEventQueryError = ErrorType<void>;
/**
 * @summary Get event by ID
 */
export declare function useGetEvent<TData = Awaited<ReturnType<typeof getEvent>>, TError = ErrorType<void>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEvent>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateEventUrl: (eventId: number) => string;
/**
 * @summary Update event
 */
export declare const updateEvent: (eventId: number, eventUpdate: EventUpdate, options?: RequestInit) => Promise<Event>;
export declare const getUpdateEventMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEvent>>, TError, {
        eventId: number;
        data: BodyType<EventUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateEvent>>, TError, {
    eventId: number;
    data: BodyType<EventUpdate>;
}, TContext>;
export type UpdateEventMutationResult = NonNullable<Awaited<ReturnType<typeof updateEvent>>>;
export type UpdateEventMutationBody = BodyType<EventUpdate>;
export type UpdateEventMutationError = ErrorType<unknown>;
/**
* @summary Update event
*/
export declare const useUpdateEvent: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEvent>>, TError, {
        eventId: number;
        data: BodyType<EventUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateEvent>>, TError, {
    eventId: number;
    data: BodyType<EventUpdate>;
}, TContext>;
export declare const getDeleteEventUrl: (eventId: number) => string;
/**
 * @summary Delete event
 */
export declare const deleteEvent: (eventId: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteEventMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteEvent>>, TError, {
        eventId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteEvent>>, TError, {
    eventId: number;
}, TContext>;
export type DeleteEventMutationResult = NonNullable<Awaited<ReturnType<typeof deleteEvent>>>;
export type DeleteEventMutationError = ErrorType<unknown>;
/**
* @summary Delete event
*/
export declare const useDeleteEvent: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteEvent>>, TError, {
        eventId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteEvent>>, TError, {
    eventId: number;
}, TContext>;
export declare const getGetEventStatsUrl: (eventId: number) => string;
/**
 * @summary Get event seating statistics
 */
export declare const getEventStats: (eventId: number, options?: RequestInit) => Promise<EventStats>;
export declare const getGetEventStatsQueryKey: (eventId: number) => readonly [`/api/events/${number}/stats`];
export declare const getGetEventStatsQueryOptions: <TData = Awaited<ReturnType<typeof getEventStats>>, TError = ErrorType<void>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEventStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getEventStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetEventStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getEventStats>>>;
export type GetEventStatsQueryError = ErrorType<void>;
/**
 * @summary Get event seating statistics
 */
export declare function useGetEventStats<TData = Awaited<ReturnType<typeof getEventStats>>, TError = ErrorType<void>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEventStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListGuestsUrl: (eventId: number) => string;
/**
 * @summary List guests for an event
 */
export declare const listGuests: (eventId: number, options?: RequestInit) => Promise<Guest[]>;
export declare const getListGuestsQueryKey: (eventId: number) => readonly [`/api/events/${number}/guests`];
export declare const getListGuestsQueryOptions: <TData = Awaited<ReturnType<typeof listGuests>>, TError = ErrorType<unknown>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listGuests>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listGuests>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListGuestsQueryResult = NonNullable<Awaited<ReturnType<typeof listGuests>>>;
export type ListGuestsQueryError = ErrorType<unknown>;
/**
 * @summary List guests for an event
 */
export declare function useListGuests<TData = Awaited<ReturnType<typeof listGuests>>, TError = ErrorType<unknown>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listGuests>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateGuestUrl: (eventId: number) => string;
/**
 * @summary Add a guest to an event
 */
export declare const createGuest: (eventId: number, guestInput: GuestInput, options?: RequestInit) => Promise<Guest>;
export declare const getCreateGuestMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createGuest>>, TError, {
        eventId: number;
        data: BodyType<GuestInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createGuest>>, TError, {
    eventId: number;
    data: BodyType<GuestInput>;
}, TContext>;
export type CreateGuestMutationResult = NonNullable<Awaited<ReturnType<typeof createGuest>>>;
export type CreateGuestMutationBody = BodyType<GuestInput>;
export type CreateGuestMutationError = ErrorType<unknown>;
/**
* @summary Add a guest to an event
*/
export declare const useCreateGuest: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createGuest>>, TError, {
        eventId: number;
        data: BodyType<GuestInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createGuest>>, TError, {
    eventId: number;
    data: BodyType<GuestInput>;
}, TContext>;
export declare const getUpdateGuestUrl: (eventId: number, guestId: number) => string;
/**
 * @summary Update guest (assign seat, update info)
 */
export declare const updateGuest: (eventId: number, guestId: number, guestUpdate: GuestUpdate, options?: RequestInit) => Promise<Guest>;
export declare const getUpdateGuestMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateGuest>>, TError, {
        eventId: number;
        guestId: number;
        data: BodyType<GuestUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateGuest>>, TError, {
    eventId: number;
    guestId: number;
    data: BodyType<GuestUpdate>;
}, TContext>;
export type UpdateGuestMutationResult = NonNullable<Awaited<ReturnType<typeof updateGuest>>>;
export type UpdateGuestMutationBody = BodyType<GuestUpdate>;
export type UpdateGuestMutationError = ErrorType<void>;
/**
* @summary Update guest (assign seat, update info)
*/
export declare const useUpdateGuest: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateGuest>>, TError, {
        eventId: number;
        guestId: number;
        data: BodyType<GuestUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateGuest>>, TError, {
    eventId: number;
    guestId: number;
    data: BodyType<GuestUpdate>;
}, TContext>;
export declare const getDeleteGuestUrl: (eventId: number, guestId: number) => string;
/**
 * @summary Delete guest from event
 */
export declare const deleteGuest: (eventId: number, guestId: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteGuestMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteGuest>>, TError, {
        eventId: number;
        guestId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteGuest>>, TError, {
    eventId: number;
    guestId: number;
}, TContext>;
export type DeleteGuestMutationResult = NonNullable<Awaited<ReturnType<typeof deleteGuest>>>;
export type DeleteGuestMutationError = ErrorType<unknown>;
/**
* @summary Delete guest from event
*/
export declare const useDeleteGuest: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteGuest>>, TError, {
        eventId: number;
        guestId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteGuest>>, TError, {
    eventId: number;
    guestId: number;
}, TContext>;
export declare const getToggleGuestCheckinUrl: (eventId: number, guestId: number) => string;
/**
 * @summary Toggle guest check-in status
 */
export declare const toggleGuestCheckin: (eventId: number, guestId: number, options?: RequestInit) => Promise<Guest>;
export declare const getToggleGuestCheckinMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof toggleGuestCheckin>>, TError, {
        eventId: number;
        guestId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof toggleGuestCheckin>>, TError, {
    eventId: number;
    guestId: number;
}, TContext>;
export type ToggleGuestCheckinMutationResult = NonNullable<Awaited<ReturnType<typeof toggleGuestCheckin>>>;
export type ToggleGuestCheckinMutationError = ErrorType<void>;
/**
* @summary Toggle guest check-in status
*/
export declare const useToggleGuestCheckin: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof toggleGuestCheckin>>, TError, {
        eventId: number;
        guestId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof toggleGuestCheckin>>, TError, {
    eventId: number;
    guestId: number;
}, TContext>;
export declare const getListFloorItemsUrl: (eventId: number) => string;
/**
 * @summary List all floor items for event
 */
export declare const listFloorItems: (eventId: number, options?: RequestInit) => Promise<FloorItem[]>;
export declare const getListFloorItemsQueryKey: (eventId: number) => readonly [`/api/events/${number}/floor-items`];
export declare const getListFloorItemsQueryOptions: <TData = Awaited<ReturnType<typeof listFloorItems>>, TError = ErrorType<unknown>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFloorItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listFloorItems>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListFloorItemsQueryResult = NonNullable<Awaited<ReturnType<typeof listFloorItems>>>;
export type ListFloorItemsQueryError = ErrorType<unknown>;
/**
 * @summary List all floor items for event
 */
export declare function useListFloorItems<TData = Awaited<ReturnType<typeof listFloorItems>>, TError = ErrorType<unknown>>(eventId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFloorItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateFloorItemUrl: (eventId: number) => string;
/**
 * @summary Add a floor item to the event map
 */
export declare const createFloorItem: (eventId: number, floorItemInput: FloorItemInput, options?: RequestInit) => Promise<FloorItem>;
export declare const getCreateFloorItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createFloorItem>>, TError, {
        eventId: number;
        data: BodyType<FloorItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createFloorItem>>, TError, {
    eventId: number;
    data: BodyType<FloorItemInput>;
}, TContext>;
export type CreateFloorItemMutationResult = NonNullable<Awaited<ReturnType<typeof createFloorItem>>>;
export type CreateFloorItemMutationBody = BodyType<FloorItemInput>;
export type CreateFloorItemMutationError = ErrorType<unknown>;
/**
* @summary Add a floor item to the event map
*/
export declare const useCreateFloorItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createFloorItem>>, TError, {
        eventId: number;
        data: BodyType<FloorItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createFloorItem>>, TError, {
    eventId: number;
    data: BodyType<FloorItemInput>;
}, TContext>;
export declare const getUpdateFloorItemUrl: (eventId: number, floorItemId: number) => string;
/**
 * @summary Update floor item (position, size, rotation, label)
 */
export declare const updateFloorItem: (eventId: number, floorItemId: number, floorItemUpdate: FloorItemUpdate, options?: RequestInit) => Promise<FloorItem>;
export declare const getUpdateFloorItemMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateFloorItem>>, TError, {
        eventId: number;
        floorItemId: number;
        data: BodyType<FloorItemUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateFloorItem>>, TError, {
    eventId: number;
    floorItemId: number;
    data: BodyType<FloorItemUpdate>;
}, TContext>;
export type UpdateFloorItemMutationResult = NonNullable<Awaited<ReturnType<typeof updateFloorItem>>>;
export type UpdateFloorItemMutationBody = BodyType<FloorItemUpdate>;
export type UpdateFloorItemMutationError = ErrorType<void>;
/**
* @summary Update floor item (position, size, rotation, label)
*/
export declare const useUpdateFloorItem: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateFloorItem>>, TError, {
        eventId: number;
        floorItemId: number;
        data: BodyType<FloorItemUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateFloorItem>>, TError, {
    eventId: number;
    floorItemId: number;
    data: BodyType<FloorItemUpdate>;
}, TContext>;
export declare const getDeleteFloorItemUrl: (eventId: number, floorItemId: number) => string;
/**
 * @summary Delete floor item from map
 */
export declare const deleteFloorItem: (eventId: number, floorItemId: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteFloorItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteFloorItem>>, TError, {
        eventId: number;
        floorItemId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteFloorItem>>, TError, {
    eventId: number;
    floorItemId: number;
}, TContext>;
export type DeleteFloorItemMutationResult = NonNullable<Awaited<ReturnType<typeof deleteFloorItem>>>;
export type DeleteFloorItemMutationError = ErrorType<unknown>;
/**
* @summary Delete floor item from map
*/
export declare const useDeleteFloorItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteFloorItem>>, TError, {
        eventId: number;
        floorItemId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteFloorItem>>, TError, {
    eventId: number;
    floorItemId: number;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map