import { BarChart, LineChart } from "echarts/charts";
import {
	AriaComponent,
	GridComponent,
	TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

// Registration stays exactly as wide as the spec's present union renders
// today; new chart kinds register here when the union grows them.
echarts.use([
	BarChart,
	LineChart,
	GridComponent,
	TooltipComponent,
	AriaComponent,
	SVGRenderer,
	CanvasRenderer,
]);

export type { ECharts } from "echarts/core";
export { echarts };
