import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import * as H from 'history'
import { upperFirst } from 'lodash'
import * as React from 'react'
import * as GQL from '../../../shared/src/graphql/schema'
import { ErrorLike } from '../../../shared/src/util/errors'
import { Form } from '../components/Form'
import { Select } from '../components/Select'
import { DynamicallyImportedMonacoSettingsEditor } from '../settings/DynamicallyImportedMonacoSettingsEditor'
import { ALL_EXTERNAL_SERVICES } from './externalServices'

interface Props {
    history: H.History
    input: GQL.IAddExternalServiceInput
    isLightTheme: boolean
    error?: ErrorLike
    mode: 'edit' | 'create'
    loading: boolean
    onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void
    onChange: (change: GQL.IAddExternalServiceInput) => void
}

export class SiteAdminExternalServiceForm extends React.Component<Props, {}> {
    public render(): JSX.Element | null {
        return (
            <Form className="external-service-form" onSubmit={this.props.onSubmit}>
                {this.props.error && <p className="alert alert-danger">{upperFirst(this.props.error.message)}</p>}
                <div className="form-group">
                    <label htmlFor="external-service-form-display-name">Display name</label>
                    <input
                        id="external-service-form-display-name"
                        type="text"
                        className="form-control"
                        required={true}
                        autoCorrect="off"
                        autoComplete="off"
                        autoFocus={true}
                        spellCheck={false}
                        value={this.props.input.displayName}
                        onChange={this.onDisplayNameChange}
                        disabled={this.props.loading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="external-service-page-form-kind">Kind</label>
                    <Select
                        id="external-service-page-form-kind"
                        onChange={this.onKindChange}
                        required={true}
                        disabled={this.props.loading || this.props.mode === 'edit'}
                        value={this.props.input.kind}
                    >
                        {Object.entries(ALL_EXTERNAL_SERVICES).map(([kind, service]) => (
                            <option key={kind} value={kind}>
                                {service.displayName}
                            </option>
                        ))}
                    </Select>
                </div>
                <div>
                    <div
                        style={{
                            border: '2px solid yellow',
                            borderRadius: '5px',
                            padding: '0.5rem 1rem',
                        }}
                    >
                        <p>
                            There are still remaining things to do:
                            <ul>
                                <li>Add a personal access token</li>
                                <li>Add at least one repository</li>
                            </ul>
                        </p>
                        For help setting the configuration, see the <a href="#">GitLab integration documentation</a> to
                        learn more or use the common action buttons below.
                    </div>
                    <p />
                    <div>
                        {/* TODO: this needs to feel "attached" to the config text area */}
                        <span data-tooltip="Use common actions to quickly edit the config. The external service will not be updated until the configuration is saved.">
                            Common actions:&nbsp;
                        </span>
                        <select>
                            {/* Default to the next action */}
                            <option>Set personal access token</option>
                            <option>Set individual repositories to mirror</option>
                            <option>Add all repositories from an organization</option>
                        </select>
                        {/*
                        <div>
                            <p style={{ marginLeft: '4rem', marginTop: '1rem' }}>
                                <label>Personal access token: </label>
                                <input />
                                <br />
                                <button>Update configuration</button>
                            </p>
                        </div>
                        */}
                        {/*
                        // NEXT:
                        // - make this a dropdown that modifies a form.
                        // - one-way sync only for "add", two-way sync for "set"
                        // - should include external instructions to (link to them in the list of steps)
                        // - all submit button text is "Update configuration box" < shouldn't update service until you click "Update service" (maybe rename to "Save")
                        // - undo (ctrl-z) should work
                        // - configuration box should animate when updated
                            */}
                    </div>
                    <p />
                </div>
                <div className="form-group">
                    <DynamicallyImportedMonacoSettingsEditor
                        // DynamicallyImportedMonacoSettingsEditor does not re-render the passed input.config
                        // if it thinks the config is dirty. We want to always replace the config if the kind changes
                        // so the editor is keyed on the kind.
                        key={this.props.input.kind}
                        value={this.props.input.config}
                        jsonSchema={ALL_EXTERNAL_SERVICES[this.props.input.kind].jsonSchema}
                        canEdit={false}
                        loading={this.props.loading}
                        height={300}
                        isLightTheme={this.props.isLightTheme}
                        onChange={this.onConfigChange}
                        history={this.props.history}
                    />
                    <p className="form-text text-muted">
                        <small>Use Ctrl+Space for completion, and hover over JSON properties for documentation.</small>
                    </p>
                </div>
                <button type="submit" className="btn btn-primary" disabled={this.props.loading}>
                    {this.props.loading && <LoadingSpinner className="icon-inline" />}
                    {this.props.mode === 'edit' ? 'Update external service' : 'Add external service'}
                </button>
            </Form>
        )
    }

    private onDisplayNameChange: React.ChangeEventHandler<HTMLInputElement> = event => {
        this.props.onChange({ ...this.props.input, displayName: event.currentTarget.value })
    }

    private onKindChange: React.ChangeEventHandler<HTMLSelectElement> = event => {
        this.props.onChange({ ...this.props.input, kind: event.currentTarget.value as GQL.ExternalServiceKind })
    }

    private onConfigChange = (config: string) => {
        this.props.onChange({ ...this.props.input, config })
    }
}
