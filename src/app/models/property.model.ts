export class Property {
  constructor(
    public register: string,
    public federalregister: string,
    public area: number,
    public name: string,
    public city: string,
    public citybbox: string,
    public bbox: string,
    public latLong: string[],
    public indigenousLand: string,
    public conservationUnit: string,
    public legalReserve: string,
    public app: string,
    public consolidatedArea: string,
    public anthropizedUse: string,
    public nativeVegetation: string,
    public prodesIndigenousLand: string,
    public prodesConservationUnit: string,
    public prodesLegalReserve: string,
    public prodesRestrictedUse: string,
    public prodesApp: string,
    public prodesConsolidatedUse: string,
    public prodesExploration: string,
    public prodesAnthropizedUse: string,
    public prodesNativeVegetation: string,
    public prodesDeforestation: string,
    public prodesEmbargoedArea: string,
    public prodesLandArea: string,
    public prodesBurnAuthorization: string,
    public prodesRadam: string,
    public owner: string,
    public foundProdes: boolean,
    public foundDeter: boolean,
    public foundBurnlight: boolean,
    public cpf?: string,
    public county?: string,
    public prodesArea?: number,
    public prodesTotalArea?: number,
    public burningSpotlights?: [],
    public burnedAreas?: [],
    public deter?: [],
    public prodesYear?: object[],
    public deterYear?: object[],
    public spotlightsYear?: [],
    public burnedAreasYear?: []
  ) {}
}
