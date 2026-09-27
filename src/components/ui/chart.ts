/** Props que Recharts inyecta en un `content={<Tooltip />}` personalizado. */
export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: { name?: string };
  }>;
}
