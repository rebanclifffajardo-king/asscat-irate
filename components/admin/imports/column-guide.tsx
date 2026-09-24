import { Card, CardBody, CardHeader } from "@/components/ui/card";

/** "Expected columns" side card shown next to an ImportWizard. */
export function ImportColumnGuide({ columns, footer }: { columns: [string, string][]; footer?: React.ReactNode }) {
  return (
    <Card className="self-start">
      <CardHeader title="Expected columns" />
      <CardBody>
        <dl className="space-y-2 text-sm">
          {columns.map(([c, d]) => (
            <div key={c}><dt className="font-semibold text-gray-800">{c}</dt><dd className="text-gray-600">{d}</dd></div>
          ))}
        </dl>
        {footer && <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">{footer}</div>}
      </CardBody>
    </Card>
  );
}
