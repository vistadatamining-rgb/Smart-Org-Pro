declare module "powerbi-visuals-api" {
  const powerbi: any;
  export default powerbi;
  export = powerbi;
}
declare module "powerbi-visuals-utils-formattingmodel" {
  export const formattingSettings: any;
  export class FormattingSettingsService {
    constructor(...args: any[]);
    populateFormattingSettingsModel(...args: any[]): any;
    buildFormattingModel(...args: any[]): any;
  }
}
