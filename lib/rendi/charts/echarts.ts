import {
	BarChart,
	HeatmapChart,
	LineChart,
	PieChart,
	RadarChart,
	ScatterChart,
} from "echarts/charts";
import {
	AriaComponent,
	CalendarComponent,
	GridComponent,
	LegendComponent,
	TooltipComponent,
	VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

// Registration stays exactly as wide as the spec's present union renders
// today; new chart kinds register here when the union grows them.
echarts.use([
	BarChart,
	LineChart,
	PieChart,
	ScatterChart,
	HeatmapChart,
	RadarChart,
	GridComponent,
	TooltipComponent,
	LegendComponent,
	VisualMapComponent,
	CalendarComponent,
	AriaComponent,
	SVGRenderer,
	CanvasRenderer,
]);

export type { ECharts } from "echarts/core";
export { echarts };
