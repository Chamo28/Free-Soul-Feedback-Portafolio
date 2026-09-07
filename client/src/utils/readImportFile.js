// Lee un archivo de importación (Excel real .xlsx/.xls, o texto CSV/TXT) y
// siempre devuelve el contenido como texto CSV — así el resto del flujo
// (textarea de import, backend) no necesita saber si el usuario subió un
// Excel real o un archivo de texto plano.
//
// La librería xlsx (~330 KB) se carga con import() dinámico, solo cuando de
// verdad se sube un .xlsx/.xls — así no infla el bundle principal que
// también descargan los evaluadores públicos (encuesta/curación), que nunca
// usan esta función.
export function readImportFile(file) {
  return new Promise((resolve, reject) => {
    const isExcel = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo."));

    if (isExcel) {
      reader.onload = async () => {
        try {
          const XLSX = await import("xlsx");
          const data = new Uint8Array(reader.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_csv(firstSheet));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsText(file);
    }
  });
}
