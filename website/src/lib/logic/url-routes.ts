import { toast } from 'svelte-sonner';
import type { Coordinates } from 'gpx';
import {
    routeWithProfile,
    routingProfiles,
    type RoutingProfile,
} from '$lib/components/toolbar/tools/routing/routing';
import { markAnchors } from '$lib/components/toolbar/tools/routing/simplify';
import { addAndSelectFiles, newGPXFiles } from '$lib/logic/file-actions';
import { i18n } from '$lib/i18n.svelte';

const defaultProfile = 'foot';

// Parse the "profile" URL parameter, falling back to the hiking profile
function parseProfileParam(value: string | null): RoutingProfile {
    return routingProfiles[value ?? defaultProfile] ?? routingProfiles[defaultProfile];
}

function isValidCoordinate(value: unknown): value is [number, number] {
    return (
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((coordinate) => typeof coordinate === 'number' && isFinite(coordinate)) &&
        Math.abs(value[0]) <= 90 &&
        Math.abs(value[1]) <= 180
    );
}

function invalidRoutesParameter() {
    toast.error(i18n._('error.invalid_routes_parameter', 'The "routes" URL parameter is invalid'));
}

// Parse the "routes" URL parameter, a JSON array of routes, each an array of at least two
// [latitude, longitude] pairs. Invalid routes are skipped, the valid ones are kept.
function parseRoutesParam(value: string | null): Coordinates[][] {
    if (value === null) {
        return [];
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        parsed = undefined;
    }

    if (!Array.isArray(parsed)) {
        invalidRoutesParameter();
        return [];
    }

    let routes = parsed
        .filter(
            (coordinates) =>
                Array.isArray(coordinates) &&
                coordinates.length >= 2 &&
                coordinates.every(isValidCoordinate)
        )
        .map((coordinates) => coordinates.map(([lat, lon]: [number, number]) => ({ lat, lon })));

    if (routes.length < parsed.length) {
        invalidRoutesParameter();
    }

    return routes;
}

async function getRoutePoints(coordinates: Coordinates[], profile: RoutingProfile) {
    try {
        let points = await routeWithProfile(coordinates, profile);
        markAnchors(points, coordinates);
        return points;
    } catch (e: any) {
        toast.error(i18n._(e.message, e.message));
        return null;
    }
}

// Create one file per route described by the "routes" URL parameter.
// Must be called once the file state collection is connected to the database.
export async function createRoutesFromURL(searchParams: URLSearchParams) {
    const profile = parseProfileParam(searchParams.get('profile'));
    const routes = parseRoutesParam(searchParams.get('routes'));

    const routedPoints = (
        await Promise.all(routes.map((coordinates) => getRoutePoints(coordinates, profile)))
    ).filter((points) => points !== null);

    let files = newGPXFiles(routedPoints.length);
    files.forEach((file, index) => {
        file.replaceTrackPoints(0, 0, 0, 0, routedPoints[index]);
        // The anchors are the points requested in the URL, do not compute them from the route
        file.getSegments()[0]._data.anchors = true;
    });

    addAndSelectFiles(files);
}
