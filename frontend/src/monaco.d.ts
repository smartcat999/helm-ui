declare module 'react-monaco-editor' {
  import * as React from 'react';
  import * as monaco from 'monaco-editor';

  export interface EditorProps {
    width?: number | string;
    height?: number | string;
    value?: string;
    defaultValue?: string;
    language?: string;
    theme?: string;
    options?: monaco.editor.IEditorOptions;
    onChange?: (value: string, event: monaco.editor.IModelContentChangedEvent) => void;
    editorDidMount?: (editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof monaco) => void;
    editorWillMount?: (monaco: typeof monaco) => void;
    context?: any;
  }

  export default class MonacoEditor extends React.Component<EditorProps> {}
} 