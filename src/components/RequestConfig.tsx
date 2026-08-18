import { EndpointInput } from './EndpointInput';
import { ScenarioSelector } from './ScenarioSelector';
import { DelayControl } from './DelayControl';
import { RunControls } from './RunControls';
import { RequestBodyEditor } from './RequestBodyEditor';
import { isBodyMethod } from '@/utils/requestBody';
import type { Scenario, HttpMethod } from '@/types';

interface RequestConfigProps {
  url: string;
  method: HttpMethod;
  scenario: Scenario;
  delay: number;
  body: string;
  isRunning: boolean;
  urlError: string | null;
  bodyError: string | null;
  onUrlChange: (url: string) => void;
  onMethodChange: (method: HttpMethod) => void;
  onScenarioChange: (scenario: Scenario) => void;
  onDelayChange: (delay: number) => void;
  onBodyChange: (body: string) => void;
  onRun: () => void;
  onReset: () => void;
}

export function RequestConfig(props: RequestConfigProps) {
  return (
    <section
      aria-label="Request configuration"
      className="flex flex-col gap-5 rounded-xl border border-slate-800 bg-slate-900/30 p-5"
    >
      <div>
        <h2 className="text-sm font-semibold text-white">Request Configuration</h2>
        <p className="mt-0.5 text-xs text-slate-500">Define the target endpoint and the failure to simulate.</p>
      </div>

      <EndpointInput
        value={props.url}
        method={props.method}
        onMethodChange={props.onMethodChange}
        onChange={props.onUrlChange}
        disabled={props.isRunning}
        error={props.urlError}
      />

      <ScenarioSelector
        value={props.scenario}
        onChange={props.onScenarioChange}
        disabled={props.isRunning}
      />

      {isBodyMethod(props.method) ? (
        <RequestBodyEditor
          method={props.method}
          value={props.body}
          onChange={props.onBodyChange}
          disabled={props.isRunning}
          error={props.bodyError}
        />
      ) : null}

      <DelayControl value={props.delay} onChange={props.onDelayChange} disabled={props.isRunning} />

      <RunControls
        onRun={props.onRun}
        onReset={props.onReset}
        isRunning={props.isRunning}
        disabled={props.isRunning}
      />
    </section>
  );
}
