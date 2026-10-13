# 1. Link to official audio; never host it

- Status: accepted

## Context

The feeds are for personal study. The audio is published by The Church of Jesus Christ of Latter-day
Saints (and, for the WEB feed, by eBible.org).

## Decision

Feeds contain only enclosure URLs that resolve to the publisher's own hosting. This repository stores
no audio, and the generator never constructs URLs; it takes them from the publisher's API or listing.

## Consequences

- No bandwidth, storage, or redistribution concerns.
- Feeds depend on upstream availability and URL stability.
- `enclosure length` is `0` since sizes are not fetched.
