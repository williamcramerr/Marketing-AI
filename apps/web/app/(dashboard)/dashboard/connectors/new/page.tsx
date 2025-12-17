import { ConnectorForm } from '../connector-form';

export default function NewConnectorPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Connector</h1>
        <p className="text-muted-foreground">
          Configure a new integration with an external service
        </p>
      </div>

      <ConnectorForm />
    </div>
  );
}
