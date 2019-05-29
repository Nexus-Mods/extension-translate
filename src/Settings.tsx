import { codes, nativeLanguageName } from './languageMap';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';
import { Alert, Button, ControlLabel, FormControl, FormGroup, InputGroup } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { actions, ComponentEx } from 'vortex-api';

export interface ISettingsProps {
  getKnownLanguages: () => Promise<string>;
  onCreateLanguage: (languageCode: string) => Promise<void>;
}

interface IConnectedProps {

}

interface IActionProps {
  onSetLanguage: (language: string) => void;
}

interface IComponentState {
  currentLanguage: string;
  knownLanguages: string[];
}

type IProps = ISettingsProps & IConnectedProps & IActionProps;

class Settings extends ComponentEx<IProps, IComponentState> {
  private mLocalesPath: string;
  constructor(props: IProps) {
    super(props);

    this.mLocalesPath = path.join(remote.app.getPath('userData'), 'locales');

    this.initState({
      currentLanguage: 'en',
      knownLanguages: [],
    });
  }

  public componentDidMount() {
    this.refreshKnownLanguages();
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { currentLanguage } = this.state;

    const languages = codes();
    languages.sort((lhs, rhs) => nativeLanguageName(lhs).localeCompare(nativeLanguageName(rhs)));

    return (
      <div style={{ position: 'relative' }}>
        <form>
          <FormGroup controlId='translateSelect'>
            <ControlLabel>{t('Translate')}</ControlLabel>
            <InputGroup style={{ width: 300 }}>
              <FormControl
                componentClass='select'
                onChange={this.selectLanguage}
                value={currentLanguage}
              >
                {languages.map(this.renderCode)}
              </FormControl>
              <InputGroup.Button>
                <Button bsStyle='primary' onClick={this.onCreateLanguage} >{t('Create')}</Button>
              </InputGroup.Button>
            </InputGroup>
            <ControlLabel>
              <Alert bsStyle='info'>
                {t(`When you create a language here it will be created in {{ langPath }}. `
                  + 'As long as the language is active, missing translations will be added to the '
                  + 'translation files automatically as you come across them inside Vortex. '
                  + 'When you edit those files, changes will become visible immediately.',
                  { replace: { langPath: this.mLocalesPath } })}
              </Alert>
            </ControlLabel>
          </FormGroup>
        </form>
      </div>
    );
  }

  private renderCode = (code: string) => {
    if (this.state.knownLanguages.indexOf(code) !== -1) {
      return null;
    }
    return (
      <option key={code} value={code}>
        {nativeLanguageName(code)}
      </option>
    );
  }

  private refreshKnownLanguages() {
    this.props.getKnownLanguages()
      .then(languages => {
        this.nextState.knownLanguages = languages;
      })
  }

  private selectLanguage = (code: React.FormEvent<any>) => {
    this.nextState.currentLanguage = code.currentTarget.value;
  }

  private onCreateLanguage = () => {
    const { onCreateLanguage, onSetLanguage } = this.props;
    const { currentLanguage } = this.state;
    onCreateLanguage(currentLanguage)
      .then(() => {
        onSetLanguage(currentLanguage);
        this.refreshKnownLanguages();
      });
  }
}

function mapStateToProps(): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetLanguage: (newLanguage: string): void => {
      dispatch(actions.setLanguage(newLanguage));
    },
  };
}


export default withTranslation(['translate'])(
  connect(mapStateToProps, mapDispatchToProps)(
    Settings) as any);
