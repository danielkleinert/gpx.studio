import {
    ramerDouglasPeucker,
    type Coordinates,
    type GPXFile,
    type TrackPoint,
    type TrackSegment,
} from 'gpx';
import { getClosestLinePoint } from '$lib/utils';

const earthRadius = 6371008.8;

export const MIN_ANCHOR_ZOOM = 0;
export const MAX_ANCHOR_ZOOM = 22;

export function getZoomLevelForDistance(latitude: number, distance?: number): number {
    if (distance === undefined) {
        return MIN_ANCHOR_ZOOM;
    }

    const rad = Math.PI / 180;
    const lat = latitude * rad;

    return Math.min(
        MAX_ANCHOR_ZOOM,
        Math.max(MIN_ANCHOR_ZOOM, Math.round(Math.log2((earthRadius * Math.cos(lat)) / distance)))
    );
}

export function updateAnchorPoints(file: GPXFile) {
    let segments = file.getSegments();

    for (let segment of segments) {
        if (!segment._data.anchors) {
            // New segment, compute anchor points for it
            computeAnchorPoints(segment);
            continue;
        }

        if (segment.trkpt.length > 0) {
            // Ensure first and last points are anchors and always visible
            segment.trkpt[0]._data.anchor = true;
            segment.trkpt[0]._data.zoom = 0;
            segment.trkpt[segment.trkpt.length - 1]._data.anchor = true;
            segment.trkpt[segment.trkpt.length - 1]._data.zoom = 0;
        }
    }
}

function computeAnchorPoints(segment: TrackSegment) {
    let points = segment.trkpt;
    let anchors = ramerDouglasPeucker(points, 1);
    anchors.forEach((anchor) => {
        let point = anchor.point;
        point._data.anchor = true;
        point._data.zoom = getZoomLevelForDistance(point.getLatitude(), anchor.distance);
    });
    segment._data.anchors = true;
}

// Turn the points of a freshly computed route matching the requested points into permanent anchors.
// The first and last routed points are the route endpoints, the intermediate requested points are
// matched to the closest point of the route.
export function markAnchors(
    routedPoints: TrackPoint[],
    requestedPoints: (TrackPoint | Coordinates)[]
) {
    let anchors = [routedPoints[0], routedPoints[routedPoints.length - 1]];
    let intermediatePoints = routedPoints.slice(1, -1);
    for (let i = 1; i < requestedPoints.length - 1; i++) {
        anchors.push(getClosestLinePoint(intermediatePoints, requestedPoints[i]));
    }
    anchors.forEach((point) => {
        point._data.anchor = true;
        point._data.zoom = MIN_ANCHOR_ZOOM;
    });
}
