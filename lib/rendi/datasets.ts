// The dataset catalog: ClickHouse's own public sample datasets, each with
// the first-party schema from their docs adapted to the source file and
// verified by a real load. Curation over inference; a catalog entry ships
// only after it has ingested end to end once.

export type CatalogDataset = {
	slug: string;
	title: string;
	description: string;
	table: string;
	source: string;
	estRows: number;
	createSql: string;
	insertSql: string;
};

const HN_SOURCE =
	"https://datasets-documentation.s3.eu-west-3.amazonaws.com/hackernews/hacknernews.csv.gz";
const UK_SOURCE =
	"https://datasets-documentation.s3.eu-west-3.amazonaws.com/uk-house-prices/parquet/house_prices_all.parquet";

export const DATASET_CATALOG: CatalogDataset[] = [
	{
		slug: "hackernews",
		title: "Hacker News",
		description:
			"Ten million Hacker News items: stories, comments, scores, and authors across the site's history.",
		table: "hackernews",
		source: HN_SOURCE,
		estRows: 10_000_000,
		createSql: `
CREATE TABLE IF NOT EXISTS default.hackernews (
	id UInt32,
	type LowCardinality(String),
	by LowCardinality(String),
	time DateTime,
	text String,
	parent UInt32,
	url String,
	score Int32,
	title String,
	descendants Int32
)
ENGINE = MergeTree
ORDER BY (type, by, time)`,
		insertSql: `
INSERT INTO default.hackernews
SELECT
	toUInt32(assumeNotNull(id)),
	assumeNotNull(type),
	coalesce(by, ''),
	parseDateTimeBestEffortOrZero(toString(time)),
	coalesce(text, ''),
	coalesce(parent, 0),
	coalesce(url, ''),
	coalesce(score, 0),
	coalesce(title, ''),
	coalesce(descendants, 0)
FROM s3('${HN_SOURCE}', 'CSVWithNames')
LIMIT 10000000`,
	},
	{
		slug: "uk-property-prices",
		title: "UK property prices",
		description:
			"Every residential property sale registered in England and Wales since 1995, about 29 million transactions.",
		table: "uk_price_paid",
		source: UK_SOURCE,
		estRows: 28_900_000,
		createSql: `
CREATE TABLE IF NOT EXISTS default.uk_price_paid (
	price UInt32,
	date Date,
	postcode1 LowCardinality(String),
	postcode2 LowCardinality(String),
	type LowCardinality(String),
	is_new UInt8,
	duration LowCardinality(String),
	addr1 String,
	addr2 String,
	street LowCardinality(String),
	locality LowCardinality(String),
	town LowCardinality(String),
	district LowCardinality(String),
	county LowCardinality(String)
)
ENGINE = MergeTree
ORDER BY (postcode1, postcode2, addr1, addr2)`,
		insertSql: `
INSERT INTO default.uk_price_paid
SELECT
	coalesce(price, 0),
	toDate(coalesce(date, 0)),
	coalesce(postcode1, ''),
	coalesce(postcode2, ''),
	coalesce(type, ''),
	coalesce(is_new, 0),
	coalesce(duration, ''),
	coalesce(addr1, ''),
	coalesce(addr2, ''),
	coalesce(street, ''),
	coalesce(locality, ''),
	coalesce(town, ''),
	coalesce(district, ''),
	coalesce(county, '')
FROM s3('${UK_SOURCE}')`,
	},
];

export function datasetBySlug(slug: string): CatalogDataset | undefined {
	return DATASET_CATALOG.find((entry) => entry.slug === slug);
}
