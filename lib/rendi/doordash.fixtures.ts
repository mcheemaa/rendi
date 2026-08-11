// Sanitized copies of live dd-cli v0.2.2 envelopes (captured 2026-08-10):
// real structure, invented identifiers, fictional addresses and cards.
// These are the parser tests' ground truth; refresh by re-capturing when
// the CLI version bumps.

export const searchFixture = {
	success: true,
	message: "Found 2 stores",
	needs_address: false,
	delivery_address: "123 Ember Lane, Oakland, CA 94601",
	widget_type: "store_list",
	assistant_instructions: "Render the widget above.",
	stores: [
		{
			store_id: "55382",
			name: "Itani Ramen",
			verified_name: "ITANI Ramen",
			rating: 4.7,
			review_count: "2400",
			image_url: "https://img.example/itani.jpg",
			delivery_time: "23 min",
			distance: "1.1 mi",
			distance_meters: 1770.3,
			is_link_out: false,
			zesty_store_id: "z-1",
		},
		{
			store_id: "33011",
			name: "Sobo Ramen",
			rating: 4.5,
			review_count: 1800,
			delivery_time: "23 min",
			distance_meters: 2100.5,
		},
	],
};

export const menuFixture = {
	success: true,
	message: "",
	menu_id: 1657275,
	store_id: "55382",
	store_name: "Itani Ramen",
	store_is_open: true,
	widget_type: "menu",
	items: [
		{
			item_id: "i_44780001",
			name: "Tonkotsu Ramen",
			description: "Pork bone broth, chashu, egg",
			image_url: "https://img.example/tonkotsu.jpg",
			price: 16.5,
			price_varies: false,
			extras: [],
			is_orderable: true,
			unavailability_reason: "",
			popular_modifications: [],
			is_popular: true,
			popularity_rank: 1,
			category_id: "c_1",
			category_name: "Ramen",
			has_modifiers: true,
			has_required_modifiers: false,
		},
		{
			item_id: "i_44780002",
			name: "Yuzu Shio Ramen",
			price: 17.25,
			is_orderable: true,
			is_popular: false,
			popularity_rank: 9,
			category_name: "Ramen",
		},
	],
	categories: [],
};

export const itemDetailsFixture = {
	success: true,
	message: "",
	item: {
		item_id: "44780001",
		name: "Tonkotsu Ramen",
		description: "Pork bone broth, chashu, egg",
		image_url: "https://img.example/tonkotsu.jpg",
		price: 16.5,
		price_varies: false,
		is_orderable: true,
		has_modifiers: true,
		has_required_modifiers: false,
		is_popular: true,
		popularity_rank: 1,
		popular_modifications: [
			{ description: "Add Extra Egg • Add Chashu Pork Belly", extras: [] },
		],
		extras: [
			{
				extra_id: "e_9794927160",
				title: "Toppings",
				min_num_options: 0,
				max_num_options: 5,
				num_free_options: 0,
				options: [
					{ option_id: "o_101", name: "Add Extra Egg", price: 3, extras: [] },
					{
						option_id: "o_102",
						name: "Combo Upgrade",
						price: 6.5,
						extras: [
							{
								extra_id: "e_inner",
								title: "Side Choice",
								options: [
									{ option_id: "o_201", name: "Gyoza", price: 0 },
									{ option_id: "o_202", name: "Karaage", price: 1.5 },
								],
							},
						],
					},
				],
			},
		],
	},
};

export const orderHistoryFixture = {
	success: true,
	message: "",
	page_full: false,
	orders: [
		{
			order_uuid: "11111111-2222-3333-4444-555555555555",
			store_id: 55382,
			store_name: "Itani Ramen",
			store_image_url: "https://img.example/itani.jpg",
			order_date: "2026-08-01T01:10:00Z",
			order_fulfilled_at: "2026-08-01T01:52:00Z",
			is_reorderable: true,
			fulfillment_type: "FULFILLMENT_TYPE_DX_DELIVERY",
			order_target: "ORDER_TARGET_RESTAURANT",
			business_id: 9,
			business_vertical_id: 1,
			items: [{ name: "Tonkotsu Ramen", quantity: 1 }],
		},
		{
			order_uuid: "66666666-7777-8888-9999-000000000000",
			store_name: "Closed Kitchen",
			is_reorderable: false,
			items: [],
		},
	],
};

export const addressListFixture = {
	success: true,
	message: "",
	widget_type: "address_list",
	trace_id: "t-1",
	timestamp: "2026-08-10T20:00:00Z",
	addresses: [
		{
			address_id: "a-1",
			address_link_id: "al-1",
			label: "Home",
			printable_address: "123 Ember Lane, Oakland, CA 94601",
			street_address: "123 Ember Lane",
			city: "Oakland",
			state: "CA",
			zip_code: "94601",
			lat: 37.79,
			lng: -122.27,
			is_default: true,
			delivery_instructions: "Gate code 000",
		},
		{
			address_id: "a-2",
			label: "Work",
			printable_address: "456 Amber Ave, Oakland, CA 94612",
			lat: 37.8,
			lng: -122.26,
			is_default: false,
		},
	],
};

export const cartShowFixture = {
	success: true,
	cart_uuid: "cccccccc-1111-2222-3333-444444444444",
	widget_type: "cart",
	assistant_instructions: "Render the widget above.",
	cart: {
		id: "cccccccc-1111-2222-3333-444444444444",
		store_id: "24006",
		store_name: "Toomie's Thai",
		items: [
			{
				id: "line-1",
				item_id: "8001",
				menu_id: "9001",
				name: "Pad See Ew",
				description: "Flat rice noodles, egg, broccoli",
				image_url: "https://img.example/padseeew.jpg",
				quantity: 3,
				price: 18.5,
				nested_options: [
					{
						id: "44958508375",
						quantity: 1,
						options: [],
						item_extra_option: { id: "44958508375", name: "Medium" },
					},
				],
			},
		],
		items_count: 1,
		group_cart_url: null,
		spend_limit_cents: null,
		is_group_cart: false,
		subcarts: [],
	},
};

export const previewFixture = {
	success: true,
	message: "Order preview generated successfully",
	cart_uuid: "cccccccc-1111-2222-3333-444444444444",
	quote: {
		currency: "USD",
		line_items: [
			{
				charge_id: "SUBTOTAL",
				label: "Subtotal",
				final_money: {
					unit_amount: 4398,
					currency: "USD",
					display_string: "$43.98",
					sign: true,
				},
			},
			{
				charge_id: "DELIVERY_FEE",
				label: "Delivery Fee",
				final_money: {
					unit_amount: 0,
					currency: "USD",
					display_string: "$0.00",
					sign: true,
				},
				original_money: {
					unit_amount: 99,
					currency: "USD",
					display_string: "$0.99",
					sign: true,
				},
			},
			{
				charge_id: "TAXES_AND_FEES",
				label: "Fees & Estimated Tax",
				final_money: {
					unit_amount: 478,
					currency: "USD",
					display_string: "$4.78",
					sign: true,
				},
			},
			{
				charge_id: "PROMOTION_DISCOUNT",
				label: "Discount",
				final_money: {
					unit_amount: 1999,
					currency: "USD",
					display_string: "-$19.99",
					sign: false,
				},
			},
		],
		total_before_tip: {
			unit_amount: 2877,
			currency: "USD",
			display_string: "$28.77",
			sign: true,
		},
		is_pre_tippable: true,
		delivery_availability: {
			asap_available: true,
			asap_pickup_available: true,
			asap_minutes_range_string: "26-41 min",
			timezone: "US/Pacific",
			delivery_options: [
				{
					delivery_option_type: "STANDARD",
					option_title: "Standard",
					eta_minutes_range: "26-41 min",
				},
				{
					delivery_option_type: "SCHEDULE",
					option_title: "Schedule",
					eta_minutes_range: null,
				},
			],
		},
	},
};

export const cartAddRequiredOptionsFixture = {
	success: false,
	message: "Some items need choices",
	cart_uuid: null,
	cart: null,
	item_errors: [
		{
			item_id: "8002",
			item_name: "Boba Tea",
			error_message: "Required options missing",
			required_options: [
				{
					name: "Ice Level",
					min_num_options: 1,
					max_num_options: 1,
					options: [
						{ id: "o-ice-1", name: "Regular Ice" },
						{ id: "o-ice-2", name: "Less Ice" },
					],
				},
			],
		},
	],
};

export const paymentMethodsFixture = {
	success: true,
	message: "",
	cards: [
		{
			payment_method_id: "pm-1",
			provider_payment_method_id: "prov-1",
			brand: "Visa",
			last4: "4242",
			exp_month: 4,
			exp_year: 2030,
		},
	],
	default_payment_method_id: "pm-1",
};
