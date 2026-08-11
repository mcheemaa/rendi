import { z } from "zod";

// Shapes for the slice of each dd-cli envelope we actually surface,
// grounded in live captures (2026-08-10, CLI v0.2.2). Zod objects strip
// unknown keys, which is deliberate twice over: the model's context stays
// lean, and DoorDash's popularity fields (is_popular, popularity_rank)
// never reach it, per the CLI's own embargo on using them.

const id = z.coerce.string();

export const ddStore = z.object({
	store_id: id,
	name: z.string(),
	verified_name: z.string().nullish(),
	rating: z.number().nullish(),
	review_count: z.coerce.number().nullish(),
	image_url: z.string().nullish(),
	delivery_time: z.string().nullish(),
	distance_meters: z.number().nullish(),
	menu_id: id.nullish(),
	printable_address: z.string().nullish(),
	availability_status: z.string().nullish(),
});
export type DdStore = z.infer<typeof ddStore>;

export const ddSearchResult = z.object({
	success: z.boolean().optional(),
	message: z.string().nullish(),
	stores: z.array(ddStore).default([]),
	needs_address: z.boolean().optional(),
	delivery_address: z.string().nullish(),
});

export const ddMenuItem = z.object({
	item_id: id,
	name: z.string(),
	description: z.string().nullish(),
	image_url: z.string().nullish(),
	price: z.number().nullish(),
	price_varies: z.boolean().optional(),
	is_orderable: z.boolean().optional(),
	category_name: z.string().nullish(),
	has_required_modifiers: z.boolean().optional(),
});
export type DdMenuItem = z.infer<typeof ddMenuItem>;

export const ddMenuResult = z.object({
	success: z.boolean().optional(),
	message: z.string().nullish(),
	menu_id: id,
	store_id: id.nullish(),
	store_name: z.string().nullish(),
	store_is_open: z.boolean().optional(),
	items: z.array(ddMenuItem).default([]),
});

export type DdExtraOption = {
	option_id: string;
	name: string;
	price?: number | null;
	extras?: DdExtra[];
};
export type DdExtra = {
	extra_id: string;
	title: string;
	min_num_options?: number | null;
	max_num_options?: number | null;
	num_free_options?: number | null;
	options?: DdExtraOption[];
};

export const ddExtra: z.ZodType<DdExtra> = z.lazy(() =>
	z.object({
		extra_id: z.string(),
		title: z.string(),
		min_num_options: z.number().nullish(),
		max_num_options: z.number().nullish(),
		num_free_options: z.number().nullish(),
		options: z.array(ddExtraOption).optional(),
	}),
);
export const ddExtraOption: z.ZodType<DdExtraOption> = z.lazy(() =>
	z.object({
		option_id: z.string(),
		name: z.string(),
		price: z.number().nullish(),
		extras: z.array(ddExtra).optional(),
	}),
);

export const ddItemDetails = z.object({
	success: z.boolean().optional(),
	message: z.string().nullish(),
	item: z.object({
		item_id: id,
		name: z.string(),
		description: z.string().nullish(),
		image_url: z.string().nullish(),
		price: z.number().nullish(),
		price_varies: z.boolean().optional(),
		is_orderable: z.boolean().optional(),
		has_required_modifiers: z.boolean().optional(),
		extras: z.array(ddExtra).default([]),
		popular_modifications: z
			.array(z.object({ description: z.string() }))
			.default([]),
	}),
});

export const ddStoreDetails = z.object({
	success: z.boolean().optional(),
	message: z.string().nullish(),
	store: ddStore,
});

export const ddOrder = z.object({
	order_uuid: z.string(),
	store_id: id.nullish(),
	store_name: z.string().nullish(),
	store_image_url: z.string().nullish(),
	order_date: z.string().nullish(),
	is_reorderable: z.boolean().optional(),
	fulfillment_type: z.string().nullish(),
	order_target: z.string().nullish(),
	items: z.array(z.unknown()).default([]),
});

export const ddOrderHistory = z.object({
	success: z.boolean().optional(),
	message: z.string().nullish(),
	orders: z.array(ddOrder).default([]),
	page_full: z.boolean().optional(),
});

export const ddAddress = z.object({
	address_id: id,
	label: z.string().nullish(),
	printable_address: z.string(),
	street_address: z.string().nullish(),
	city: z.string().nullish(),
	state: z.string().nullish(),
	zip_code: z.string().nullish(),
	lat: z.number(),
	lng: z.number(),
	is_default: z.boolean().optional(),
	delivery_instructions: z.string().nullish(),
});

export const ddAddressList = z.object({
	success: z.boolean().optional(),
	message: z.string().nullish(),
	addresses: z.array(ddAddress).default([]),
});

export const ddPaymentMethods = z.object({
	success: z.boolean().optional(),
	message: z.string().nullish(),
	cards: z
		.array(
			z.object({
				payment_method_id: id,
				brand: z.string().nullish(),
				last4: z.string().nullish(),
				exp_month: z.coerce.number().nullish(),
				exp_year: z.coerce.number().nullish(),
			}),
		)
		.default([]),
	default_payment_method_id: id.nullish(),
});

// Receipt and in-store item search are surfaced leniently until their
// verticals get first-class treatment: the model reads what came back.
export const ddLenient = z.record(z.string(), z.unknown());
