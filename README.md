# esm-querystore-app

An [omnibar](https://github.com/pbiondich/openmrs-esm-omnibar-app) provider for OpenMRS 3 that finds values in the open chart using the OpenMRS query store. Type `cd4` inside a patient's chart and you get their latest CD4 count, with its date, from the query store's index. With nothing typed, you get the chart's most recent records.

**Status:** prototype. It type-checks, lints, builds and passes its unit tests.

It lives in its own repo for now, so it can be installed (or not) independently of the omnibar. I think it may well end up in the patient chart later, but that's a conversation for when the query store has more frontend users than this one.

## What it does

- **Provider.** `omnibar-querystore-chart-provider` registers in the omnibar's `omnibar-providers-slot` from this app's own [`routes.json`](src/routes.json). It runs only inside a chart (patient scope), in the record lane at order 15, right after the omnibar's own chart lookup. While you type, it asks `/querystore/patient/{uuid}/search` (keyword mode, one row per concept), and with an empty field it asks `/recent`. Choosing a row opens the matching chart tab.
- **Plays nicely with chart lookup.** It shares the `chart-values` dedupe key with chart lookup, so a value both of them find shows up once, and chart lookup's copy wins. It answers `/lab` too.
- **Never sees a scanned ID.** It sets `skipIdentifierQueries`, so a wristband or MRN never reaches the index.
- **Warms charts.** A page that renders nothing loads the app on chart routes, so it can ask the query store to index a chart as soon as it's opened. That way the first search usually finds it ready.
- **Fails quietly.** If the query store can't be reached, its group shrinks to "Unavailable right now". While a chart is still being indexed, it shows what it has found so far, re-checks a few times, and then stops.

It's mounted only for users with `Get Observations`, and each record type is shown only to a user who may read it.

## What it needs

- The omnibar, at contract version 1.
- The `querystore` backend module (`1.0.0-SNAPSHOT` or later) on the server.

## Install

Install it as you would any O3 frontend module:

1. Build it (`yarn build`) and put `dist/` on the server with your other frontend modules.
2. Add an importmap entry for `@openmrs/esm-querystore-app` pointing at `openmrs-esm-querystore-app.js` in that directory.
3. Add its `routes.json` (built into `dist/routes.json`) to the routes registry.

Installing it turns it on. There's no flag in the omnibar to flip.

## Config

All under `@openmrs/esm-querystore-app`:

| Key | Default | What it does |
| --- | --- | --- |
| `minSearchCharacters` | `2` | Characters needed before the index is searched. |
| `resultsUrl` | `${openmrsSpaBase}/patient/${patientUuid}/chart/Results` | Where choosing a chart value goes. |
| `warmOnChartOpen` | `true` | Ask the query store to index a chart when the user opens it. |

By default it runs beside the omnibar's chart lookup. If you'd rather have the query store be the only source of chart values, remove chart lookup from the omnibar's slot:

```json
{
  "@openmrs/esm-omnibar-app": {
    "extensionSlots": { "omnibar-providers-slot": { "remove": ["omnibar-chart-lookup-provider"] } }
  }
}
```

## Development

```sh
yarn install
yarn start                 # openmrs develop, serving this app; takes --backend as usual
yarn verify                # lint, type-check, and the vitest suite with coverage
yarn build                 # rspack production build into dist/
yarn extract-translations  # refresh translations/en.json
```

If plain `yarn` isn't on your PATH, use the copy the repo pins: `node .yarn/releases/yarn-4.10.3.cjs <command>`.

To run it next to the omnibar, with both apps in the dev import map, give `openmrs develop` both sources:

```sh
yarn start --sources ../openmrs-esm-omnibar-app --sources .
```

The provider only returns results from a backend that has the `querystore` module installed.

## The contract copy

[`src/omnibar-contract/`](src/omnibar-contract/) is a copy of the omnibar's contract folder, and this app talks to the omnibar through it alone. Please don't edit it here. Fix the original in the [omnibar repo](https://github.com/pbiondich/openmrs-esm-omnibar-app), copy the whole folder over again, and update the hash in [`src/app-boundary.test.ts`](src/app-boundary.test.ts), which fails if the copy drifts. The same test checks that the app imports nothing but its own files, that copy, the framework, React, react-i18next and SWR.

## License

[MPL-2.0](LICENSE), like the omnibar.
