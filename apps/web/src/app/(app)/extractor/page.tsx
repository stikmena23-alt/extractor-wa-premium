import { Dropzone } from "./components/Dropzone";

export default function ExtractorPage() {
  return (
    <div className="page extractor-page">
      <header className="page-header">
        <h1>Extractor Premium</h1>
        <p>Procesa tus archivos y contactos de manera secuencial, descontando créditos automáticamente.</p>
      </header>
      <Dropzone />
    </div>
  );
}
