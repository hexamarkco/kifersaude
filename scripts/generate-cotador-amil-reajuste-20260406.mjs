import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const AGE_RANGES = ['0-18', '19-23', '24-28', '29-33', '34-38', '39-43', '44-48', '49-53', '54-58', '59+'];

const envPath = path.resolve(process.cwd(), '.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
    }),
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);
const cotadorJsonDir = path.resolve(process.cwd(), 'cotador-json');

const buildPriceRow = (values) => Object.fromEntries(AGE_RANGES.map((range, index) => [range, values[index]]));

const dualProduct = (abrangencia, enfermariaKey, apartamentoKey) => ({
  abrangencia,
  acomodacoes: ['Enfermaria', 'Apartamento'],
  columns: {
    Enfermaria: enfermariaKey,
    Apartamento: apartamentoKey,
  },
});

const singleProduct = (abrangencia, key) => ({
  abrangencia,
  acomodacoes: ['Enfermaria'],
  columns: {
    Enfermaria: key,
  },
});

const apartmentOnlyProduct = (abrangencia, key) => ({
  abrangencia,
  acomodacoes: ['Apartamento'],
  columns: {
    Apartamento: key,
  },
});

const AMIL_PRODUCTS = {
  'Bronze RJ': singleProduct('Regional', 'bronzeRj'),
  'Bronze RJ Mais': singleProduct('Estadual', 'bronzeRjMais'),
  Prata: dualProduct('Nacional', 'prataQc', 'prataQp'),
  Ouro: dualProduct('Nacional', 'ouroQc', 'ouroQp'),
  'Platinum R1': apartmentOnlyProduct('Nacional', 'platinumR1Qp'),
  'Platinum R2': apartmentOnlyProduct('Nacional', 'platinumR2Qp'),
};

const SELECIONADA_PRODUCTS = {
  S380: dualProduct('Nacional', 's380Qc', 's380Qp'),
  S450: dualProduct('Nacional', 's450Qc', 's450Qp'),
  'S750 R1': apartmentOnlyProduct('Nacional', 's750R1Qp'),
  'S750 R2': apartmentOnlyProduct('Nacional', 's750R2Qp'),
  'S750 R3': apartmentOnlyProduct('Nacional', 's750R3Qp'),
};

const amilTotalNaoMeiBase = {
  bronzeRj: [129.67, 176.09, 206.71, 206.71, 206.71, 230.9, 318.87, 380.73, 547.49, 776.34],
  bronzeRjMais: [179.83, 210.4, 256.69, 308.03, 323.43, 355.77, 444.71, 489.18, 611.48, 1070.09],
  prataQc: [208.34, 243.76, 297.39, 356.87, 374.71, 412.18, 515.23, 566.75, 708.44, 1239.77],
  prataQp: [231.26, 270.57, 330.1, 396.12, 415.93, 457.52, 571.9, 629.09, 786.36, 1376.13],
  ouroQc: [239.99, 280.79, 342.56, 411.07, 431.62, 474.78, 593.48, 652.83, 816.04, 1428.07],
  ouroQp: [266.39, 311.68, 380.25, 456.3, 479.12, 527.03, 658.79, 724.67, 905.84, 1585.22],
  platinumR1Qp: [322.31, 377.1, 460.06, 552.07, 579.67, 637.64, 797.05, 876.76, 1095.95, 1917.91],
  platinumR2Qp: [325.51, 380.85, 464.64, 557.57, 585.45, 644.0, 805.0, 885.5, 1106.88, 1937.04],
};

const amilTotalMeiBase = {
  bronzeRj: [154.96, 210.44, 247.04, 247.04, 247.04, 275.94, 381.07, 455.0, 654.29, 927.78],
  bronzeRjMais: [214.9, 251.43, 306.74, 368.09, 386.49, 425.14, 531.43, 584.57, 730.71, 1278.74],
  prataQc: [248.97, 291.29, 355.37, 426.44, 447.76, 492.54, 615.68, 677.25, 846.56, 1481.48],
  prataQp: [276.36, 323.34, 394.47, 473.36, 497.03, 546.73, 683.41, 751.75, 939.69, 1644.46],
  ouroQc: [286.79, 335.54, 409.36, 491.23, 515.79, 567.37, 709.21, 780.13, 975.16, 1706.53],
  ouroQp: [318.34, 372.46, 454.4, 545.28, 572.54, 629.79, 787.24, 865.96, 1082.45, 1894.29],
  platinumR1Qp: [385.17, 450.65, 549.79, 659.75, 692.74, 762.01, 952.51, 1047.76, 1309.7, 2291.98],
  platinumR2Qp: [388.99, 455.12, 555.25, 666.3, 699.62, 769.58, 961.98, 1058.18, 1322.73, 2314.78],
};

const amilPartialNaoMeiBase = {
  bronzeRj: [172.89, 234.78, 275.61, 275.61, 275.61, 307.86, 425.15, 507.63, 729.97, 1035.1],
  bronzeRjMais: [239.77, 280.53, 342.25, 410.7, 431.24, 474.36, 592.95, 652.25, 815.31, 1426.79],
  prataQc: [277.78, 325.0, 396.5, 475.8, 499.59, 549.55, 686.94, 755.63, 944.54, 1652.95],
  prataQp: [308.34, 360.76, 440.13, 528.16, 554.57, 610.03, 762.54, 838.79, 1048.49, 1834.86],
  ouroQc: [319.98, 374.38, 456.74, 548.09, 575.49, 633.04, 791.3, 870.43, 1088.04, 1904.07],
  ouroQp: [355.17, 415.55, 506.97, 608.36, 638.78, 702.66, 878.33, 966.16, 1207.7, 2113.48],
  platinumR1Qp: [429.74, 502.8, 613.42, 736.1, 772.91, 850.2, 1062.75, 1169.03, 1461.29, 2557.26],
  platinumR2Qp: [434.0, 507.78, 619.49, 743.39, 780.56, 858.62, 1073.28, 1180.61, 1475.76, 2582.58],
};

const amilPartialMeiBase = {
  bronzeRj: [206.61, 280.58, 329.37, 329.37, 329.37, 367.91, 508.08, 606.65, 872.36, 1237.01],
  bronzeRjMais: [286.53, 335.24, 408.99, 490.79, 515.33, 566.86, 708.58, 779.44, 974.3, 1705.03],
  prataQc: [331.95, 388.38, 473.82, 568.58, 597.01, 656.71, 820.89, 902.98, 1128.73, 1975.28],
  prataQp: [368.47, 431.11, 525.95, 631.14, 662.7, 728.97, 911.21, 1002.33, 1252.91, 2192.59],
  ouroQc: [382.38, 447.38, 545.8, 654.96, 687.71, 756.48, 945.6, 1040.16, 1300.2, 2275.35],
  ouroQp: [424.44, 496.59, 605.84, 727.01, 763.36, 839.7, 1049.63, 1154.59, 1443.24, 2525.67],
  platinumR1Qp: [513.55, 600.85, 733.04, 879.65, 923.63, 1015.99, 1269.99, 1396.99, 1746.24, 3055.92],
  platinumR2Qp: [518.64, 606.81, 740.31, 888.37, 932.79, 1026.07, 1282.59, 1410.85, 1763.56, 3086.23],
};

const amilTotalNaoMei529 = {
  bronzeRj: [129.67, 176.09, 206.71, 206.71, 206.71, 230.9, 318.87, 380.73, 547.49, 776.34],
  bronzeRjMais: [179.83, 210.4, 256.69, 308.03, 323.43, 355.77, 444.71, 489.18, 611.48, 1070.09],
  prataQc: [187.38, 219.23, 267.46, 320.95, 337.0, 370.7, 463.38, 509.72, 637.15, 1115.01],
  prataQp: [208.0, 243.36, 296.9, 356.28, 374.09, 411.5, 514.38, 565.82, 707.28, 1237.74],
  ouroQc: [215.85, 252.54, 308.1, 369.72, 388.21, 427.03, 533.79, 587.17, 733.96, 1284.43],
  ouroQp: [239.59, 280.32, 341.99, 410.39, 430.91, 474.0, 592.5, 651.75, 814.69, 1425.71],
  platinumR1Qp: [289.89, 339.17, 413.79, 496.55, 521.38, 573.52, 716.9, 788.59, 985.74, 1725.05],
  platinumR2Qp: [292.76, 342.53, 417.89, 501.47, 526.54, 579.19, 723.99, 796.39, 995.49, 1742.11],
};

const amilTotalMei529 = {
  bronzeRj: [154.96, 210.44, 247.04, 247.04, 247.04, 275.94, 381.07, 455.0, 654.29, 927.78],
  bronzeRjMais: [214.9, 251.43, 306.74, 368.09, 386.49, 425.14, 531.43, 584.57, 730.71, 1278.74],
  prataQc: [223.92, 261.99, 319.63, 383.56, 402.74, 443.01, 553.76, 609.14, 761.43, 1332.5],
  prataQp: [248.56, 290.82, 354.8, 425.76, 447.05, 491.76, 614.7, 676.17, 845.21, 1479.12],
  ouroQc: [257.94, 301.79, 368.18, 441.82, 463.91, 510.3, 637.88, 701.67, 877.09, 1534.91],
  ouroQp: [286.31, 334.98, 408.68, 490.42, 514.94, 566.43, 708.04, 778.84, 973.55, 1703.71],
  platinumR1Qp: [346.42, 405.31, 494.48, 593.38, 623.05, 685.36, 856.7, 942.37, 1177.96, 2061.43],
  platinumR2Qp: [349.86, 409.34, 499.39, 599.27, 629.23, 692.15, 865.19, 951.71, 1189.64, 2081.87],
};

const amilPartialNaoMei529 = {
  bronzeRj: [172.89, 234.78, 275.61, 275.61, 275.61, 307.86, 425.15, 507.63, 729.97, 1035.1],
  bronzeRjMais: [239.77, 280.53, 342.25, 410.7, 431.24, 474.36, 592.95, 652.25, 815.31, 1426.79],
  prataQc: [249.84, 292.31, 356.62, 427.94, 449.34, 494.27, 617.84, 679.62, 849.53, 1486.68],
  prataQp: [277.32, 324.46, 395.84, 475.01, 498.76, 548.64, 685.8, 754.38, 942.98, 1650.22],
  ouroQc: [287.79, 336.71, 410.79, 492.95, 517.6, 569.36, 711.7, 782.87, 978.59, 1712.53],
  ouroQp: [319.44, 373.74, 455.96, 547.15, 574.51, 631.96, 789.95, 868.95, 1086.19, 1900.83],
  platinumR1Qp: [386.51, 452.22, 551.71, 662.05, 695.15, 764.67, 955.84, 1051.42, 1314.28, 2299.99],
  platinumR2Qp: [390.34, 456.7, 557.17, 668.6, 702.03, 772.23, 965.29, 1061.82, 1327.28, 2322.74],
};

const amilPartialMei529 = {
  bronzeRj: [206.61, 280.58, 329.37, 329.37, 329.37, 367.91, 508.08, 606.65, 872.36, 1237.01],
  bronzeRjMais: [286.53, 335.24, 408.99, 490.79, 515.33, 566.86, 708.58, 779.44, 974.3, 1705.03],
  prataQc: [298.56, 349.32, 426.17, 511.4, 536.97, 590.67, 738.34, 812.17, 1015.21, 1776.62],
  prataQp: [331.4, 387.74, 473.04, 567.65, 596.03, 655.63, 819.54, 901.49, 1126.86, 1972.01],
  ouroQc: [343.91, 402.37, 490.89, 589.07, 618.52, 680.37, 850.46, 935.51, 1169.39, 2046.43],
  ouroQp: [381.74, 446.64, 544.9, 653.88, 686.57, 755.23, 944.04, 1038.44, 1298.05, 2271.59],
  platinumR1Qp: [461.89, 540.41, 659.3, 791.16, 830.72, 913.79, 1142.24, 1256.46, 1570.58, 2748.52],
  platinumR2Qp: [466.46, 545.76, 665.83, 799.0, 838.95, 922.85, 1153.56, 1268.92, 1586.15, 2775.76],
};

const amilTotalTodosCompulsorio = {
  bronzeRj: [123.19, 167.29, 196.38, 196.38, 196.38, 219.36, 302.94, 361.71, 520.14, 737.56],
  bronzeRjMais: [170.84, 199.88, 243.85, 292.62, 307.25, 337.98, 422.48, 464.73, 580.91, 1016.59],
  prataQc: [181.89, 212.81, 259.63, 311.56, 327.14, 359.85, 449.81, 494.79, 618.49, 1082.36],
  prataQp: [201.9, 236.22, 288.19, 345.83, 363.12, 399.43, 499.29, 549.22, 686.53, 1201.43],
  ouroQc: [209.52, 245.14, 299.07, 358.88, 376.82, 414.5, 518.13, 569.94, 712.43, 1246.75],
  ouroQp: [232.57, 272.11, 331.97, 398.36, 418.28, 460.11, 575.14, 632.65, 790.81, 1383.92],
  platinumR1Qp: [281.39, 329.23, 401.66, 481.99, 506.09, 556.7, 695.88, 765.47, 956.84, 1674.47],
  platinumR2Qp: [284.18, 332.49, 405.64, 486.77, 511.11, 562.22, 702.78, 773.06, 966.33, 1691.08],
};

const amilTotalTodosLivre = {
  bronzeRj: [147.21, 199.91, 234.67, 234.67, 234.67, 262.13, 362.0, 432.23, 621.55, 881.36],
  bronzeRjMais: [204.16, 238.87, 291.42, 349.7, 367.19, 403.91, 504.89, 555.38, 694.23, 1214.9],
  prataQc: [217.36, 254.31, 310.26, 372.31, 390.93, 430.02, 537.53, 591.28, 739.1, 1293.43],
  prataQp: [241.27, 282.29, 344.39, 413.27, 433.93, 477.32, 596.65, 656.32, 820.4, 1435.7],
  ouroQc: [250.38, 292.94, 357.39, 428.87, 450.31, 495.34, 619.18, 681.1, 851.38, 1489.92],
  ouroQp: [277.92, 325.17, 396.71, 476.05, 499.85, 549.84, 687.3, 756.03, 945.04, 1653.82],
  platinumR1Qp: [336.26, 393.42, 479.97, 575.96, 604.76, 665.24, 831.55, 914.71, 1143.39, 2000.93],
  platinumR2Qp: [339.6, 397.33, 484.74, 581.69, 610.77, 671.85, 839.81, 923.79, 1154.74, 2020.8],
};

const amilPartialTodosCompulsorio = {
  bronzeRj: [164.25, 223.05, 261.84, 261.84, 261.84, 292.48, 403.91, 482.27, 693.5, 983.38],
  bronzeRjMais: [227.78, 266.5, 325.13, 390.16, 409.67, 450.64, 563.3, 619.63, 774.54, 1355.45],
  prataQc: [242.51, 283.74, 346.16, 415.39, 436.16, 479.78, 599.73, 659.7, 824.63, 1443.1],
  prataQp: [269.19, 314.95, 384.24, 461.09, 484.14, 532.55, 665.69, 732.26, 915.33, 1601.83],
  ouroQc: [279.35, 326.84, 398.74, 478.49, 502.41, 552.65, 690.81, 759.89, 949.86, 1662.26],
  ouroQp: [310.07, 362.78, 442.59, 531.11, 557.67, 613.44, 766.8, 843.48, 1054.35, 1845.11],
  platinumR1Qp: [375.18, 438.96, 535.53, 642.64, 674.77, 742.25, 927.81, 1020.59, 1275.74, 2232.55],
  platinumR2Qp: [378.89, 443.3, 540.83, 649.0, 681.45, 749.6, 937.0, 1030.7, 1288.38, 2254.67],
};

const amilPartialTodosLivre = {
  bronzeRj: [196.28, 266.55, 312.9, 312.9, 312.9, 349.51, 482.67, 576.31, 828.73, 1175.14],
  bronzeRjMais: [272.2, 318.47, 388.53, 466.24, 489.55, 538.51, 673.14, 740.45, 925.56, 1619.73],
  prataQc: [289.8, 339.07, 413.67, 496.4, 521.22, 573.34, 716.68, 788.35, 985.44, 1724.52],
  prataQp: [321.69, 376.38, 459.18, 551.02, 578.57, 636.43, 795.54, 875.09, 1093.86, 1914.26],
  ouroQc: [333.83, 390.58, 476.51, 571.81, 600.4, 660.44, 825.55, 908.11, 1135.14, 1986.5],
  ouroQp: [370.55, 433.54, 528.92, 634.7, 666.44, 733.08, 916.35, 1007.99, 1259.99, 2204.98],
  platinumR1Qp: [448.34, 524.56, 639.96, 767.95, 806.35, 886.99, 1108.74, 1219.61, 1524.51, 2667.89],
  platinumR2Qp: [452.79, 529.76, 646.31, 775.57, 814.35, 895.79, 1119.74, 1231.71, 1539.64, 2694.37],
};

const selecionadaTotalNaoMeiBase = {
  s380Qc: [228.56, 267.42, 326.25, 391.5, 411.08, 452.19, 565.24, 621.76, 777.2, 1360.1],
  s380Qp: [253.69, 296.82, 362.12, 434.54, 456.27, 501.9, 627.38, 690.12, 862.65, 1509.64],
  s450Qc: [263.25, 308.0, 375.76, 450.91, 473.46, 520.81, 651.01, 716.11, 895.14, 1566.5],
  s450Qp: [292.21, 341.89, 417.11, 500.53, 525.56, 578.12, 722.65, 794.92, 993.65, 1738.89],
  s750R1Qp: [353.87, 414.03, 505.12, 606.14, 636.45, 700.1, 875.13, 962.64, 1203.3, 2105.78],
  s750R2Qp: [357.4, 418.16, 510.16, 612.19, 642.8, 707.08, 883.85, 972.24, 1215.3, 2126.78],
  s750R3Qp: [385.98, 451.6, 550.95, 661.14, 694.2, 763.62, 954.53, 1049.98, 1312.48, 2296.84],
};

const selecionadaTotalMeiBase = {
  s380Qc: [273.13, 319.56, 389.86, 467.83, 491.22, 540.34, 675.43, 742.97, 928.71, 1625.24],
  s380Qp: [303.17, 354.71, 432.75, 519.3, 545.27, 599.8, 749.75, 824.73, 1030.91, 1804.09],
  s450Qc: [314.59, 368.07, 449.05, 538.86, 565.8, 622.38, 777.98, 855.78, 1069.73, 1872.03],
  s450Qp: [349.2, 408.56, 498.44, 598.13, 628.04, 690.84, 863.55, 949.91, 1187.39, 2077.93],
  s750R1Qp: [422.89, 494.78, 603.63, 724.36, 760.58, 836.64, 1045.8, 1150.38, 1437.98, 2516.47],
  s750R2Qp: [427.1, 499.71, 609.65, 731.58, 768.16, 844.98, 1056.23, 1161.85, 1452.31, 2541.54],
  s750R3Qp: [461.26, 539.67, 658.4, 790.08, 829.58, 912.54, 1140.68, 1254.75, 1568.44, 2744.77],
};

const selecionadaPartialNaoMeiBase = {
  s380Qc: [304.73, 356.53, 434.97, 521.96, 548.06, 602.87, 753.59, 828.95, 1036.19, 1813.33],
  s380Qp: [338.25, 395.75, 482.82, 579.38, 608.35, 669.19, 836.49, 920.14, 1150.18, 2012.82],
  s450Qc: [350.99, 410.66, 501.01, 601.21, 631.27, 694.4, 868.0, 954.8, 1193.5, 2088.63],
  s450Qp: [389.61, 455.84, 556.12, 667.34, 700.71, 770.78, 963.48, 1059.83, 1324.79, 2318.38],
  s750R1Qp: [471.82, 552.03, 673.48, 808.18, 848.59, 933.45, 1166.81, 1283.49, 1604.36, 2807.63],
  s750R2Qp: [476.52, 557.53, 680.19, 816.23, 857.04, 942.74, 1178.43, 1296.27, 1620.34, 2835.6],
  s750R3Qp: [514.63, 602.12, 734.59, 881.51, 925.59, 1018.15, 1272.69, 1399.96, 1749.95, 3062.41],
};

const selecionadaPartialMeiBase = {
  s380Qc: [364.16, 426.07, 519.81, 623.77, 654.96, 720.46, 900.58, 990.64, 1238.3, 2167.03],
  s380Qp: [404.22, 472.94, 576.99, 692.39, 727.01, 799.71, 999.64, 1099.6, 1374.5, 2405.38],
  s450Qc: [419.44, 490.74, 598.7, 718.44, 754.36, 829.8, 1037.25, 1140.98, 1426.23, 2495.9],
  s450Qp: [465.59, 544.74, 664.58, 797.5, 837.38, 921.12, 1151.4, 1266.54, 1583.18, 2770.57],
  s750R1Qp: [563.84, 659.69, 804.82, 965.78, 1014.07, 1115.48, 1394.35, 1533.79, 1917.24, 3355.17],
  s750R2Qp: [569.45, 666.26, 812.84, 975.41, 1024.18, 1126.6, 1408.25, 1549.08, 1936.35, 3388.61],
  s750R3Qp: [615.0, 719.55, 877.85, 1053.42, 1106.09, 1216.7, 1520.88, 1672.97, 2091.21, 3659.62],
};

const selecionadaTotalNaoMei529 = {
  s380Qc: [205.57, 240.52, 293.43, 352.12, 369.73, 406.7, 508.38, 559.22, 699.03, 1223.3],
  s380Qp: [228.17, 266.96, 325.69, 390.83, 410.37, 451.41, 564.26, 620.69, 775.86, 1357.76],
  s450Qc: [236.77, 277.02, 337.96, 405.55, 425.83, 468.41, 585.51, 644.06, 805.08, 1408.89],
  s450Qp: [262.81, 307.49, 375.14, 450.17, 472.68, 519.95, 649.94, 714.93, 893.66, 1563.91],
  s750R1Qp: [318.27, 372.38, 454.3, 545.16, 572.42, 629.66, 787.08, 865.79, 1082.24, 1893.92],
  s750R2Qp: [321.45, 376.1, 458.84, 550.61, 578.14, 635.95, 794.94, 874.43, 1093.04, 1912.82],
  s750R3Qp: [347.15, 406.17, 495.53, 594.64, 624.37, 686.81, 858.51, 944.36, 1180.45, 2065.79],
};

const selecionadaTotalMei529 = {
  s380Qc: [245.65, 287.41, 350.64, 420.77, 441.81, 485.99, 607.49, 668.24, 835.3, 1461.78],
  s380Qp: [272.67, 319.02, 389.2, 467.04, 490.39, 539.43, 674.29, 741.72, 927.15, 1622.51],
  s450Qc: [282.94, 331.04, 403.87, 484.64, 508.87, 559.76, 699.7, 769.67, 962.09, 1683.66],
  s450Qp: [314.07, 367.46, 448.3, 537.96, 564.86, 621.35, 776.69, 854.36, 1067.95, 1868.91],
  s750R1Qp: [380.35, 445.01, 542.91, 651.49, 684.06, 752.47, 940.59, 1034.65, 1293.31, 2263.29],
  s750R2Qp: [384.13, 449.43, 548.3, 657.96, 690.86, 759.95, 949.94, 1044.93, 1306.16, 2285.78],
  s750R3Qp: [414.86, 485.39, 592.18, 710.62, 746.15, 820.77, 1025.96, 1128.56, 1410.7, 2468.73],
};

const selecionadaPartialNaoMei529 = {
  s380Qc: [274.07, 320.66, 391.21, 469.45, 492.92, 542.21, 677.76, 745.54, 931.93, 1630.88],
  s380Qp: [304.22, 355.94, 434.25, 521.1, 547.16, 601.88, 752.35, 827.59, 1034.49, 1810.36],
  s450Qc: [315.68, 369.35, 450.61, 540.73, 567.77, 624.55, 780.69, 858.76, 1073.45, 1878.54],
  s450Qp: [350.42, 409.99, 500.19, 600.23, 630.24, 693.26, 866.58, 953.24, 1191.55, 2085.21],
  s750R1Qp: [424.35, 496.49, 605.72, 726.86, 763.2, 839.52, 1049.4, 1154.34, 1442.93, 2525.13],
  s750R2Qp: [428.58, 501.44, 611.76, 734.11, 770.82, 847.9, 1059.88, 1165.87, 1457.34, 2550.35],
  s750R3Qp: [462.86, 541.55, 660.69, 792.83, 832.47, 915.72, 1144.65, 1259.12, 1573.9, 2754.33],
};

const selecionadaPartialMei529 = {
  s380Qc: [327.53, 383.21, 467.52, 561.02, 589.07, 647.98, 809.98, 890.98, 1113.73, 1949.03],
  s380Qp: [363.56, 425.37, 518.95, 622.74, 653.88, 719.27, 899.09, 989.0, 1236.25, 2163.44],
  s450Qc: [377.24, 441.37, 538.47, 646.16, 678.47, 746.32, 932.9, 1026.19, 1282.74, 2244.8],
  s450Qp: [418.75, 489.94, 597.73, 717.28, 753.14, 828.45, 1035.56, 1139.12, 1423.9, 2491.83],
  s750R1Qp: [507.12, 593.33, 723.86, 868.63, 912.06, 1003.27, 1254.09, 1379.5, 1724.38, 3017.67],
  s750R2Qp: [512.16, 599.23, 731.06, 877.27, 921.13, 1013.24, 1266.55, 1393.21, 1741.51, 3047.64],
  s750R3Qp: [553.13, 647.16, 789.54, 947.45, 994.82, 1094.3, 1367.88, 1504.67, 1880.84, 3291.47],
};

const selecionadaTotalTodosCompulsorio = {
  s380Qc: [199.54, 233.46, 284.82, 341.78, 358.87, 394.76, 493.45, 542.8, 678.5, 1187.38],
  s380Qp: [221.48, 259.13, 316.14, 379.37, 398.34, 438.17, 547.71, 602.48, 753.1, 1317.93],
  s450Qc: [229.82, 268.89, 328.05, 393.66, 413.34, 454.67, 568.34, 625.17, 781.46, 1367.56],
  s450Qp: [255.11, 298.48, 364.15, 436.98, 458.83, 504.71, 630.89, 693.98, 867.48, 1518.09],
  s750R1Qp: [308.94, 361.46, 440.98, 529.18, 555.64, 611.2, 764.0, 840.4, 1050.5, 1838.38],
  s750R2Qp: [312.02, 365.06, 445.37, 534.44, 561.16, 617.28, 771.6, 848.76, 1060.95, 1856.66],
  s750R3Qp: [336.97, 394.25, 480.99, 577.19, 606.05, 666.66, 833.33, 916.66, 1145.83, 2005.2],
};

const selecionadaTotalTodosLivre = {
  s380Qc: [238.45, 278.99, 340.37, 408.44, 428.86, 471.75, 589.69, 648.66, 810.83, 1418.95],
  s380Qp: [264.68, 309.68, 377.81, 453.37, 476.04, 523.64, 654.55, 720.01, 900.01, 1575.02],
  s450Qc: [274.65, 321.34, 392.03, 470.44, 493.96, 543.36, 679.2, 747.12, 933.9, 1634.33],
  s450Qp: [304.86, 356.69, 435.16, 522.19, 548.3, 603.13, 753.91, 829.3, 1036.63, 1814.1],
  s750R1Qp: [369.2, 431.96, 526.99, 632.39, 664.01, 730.41, 913.01, 1004.31, 1255.39, 2196.93],
  s750R2Qp: [372.87, 436.26, 532.24, 638.69, 670.62, 737.68, 922.1, 1014.31, 1267.89, 2218.81],
  s750R3Qp: [402.69, 471.15, 574.8, 689.76, 724.25, 796.68, 995.85, 1095.44, 1369.3, 2396.28],
};

const selecionadaPartialTodosCompulsorio = {
  s380Qc: [266.04, 311.27, 379.75, 455.7, 478.49, 526.34, 657.93, 723.72, 904.65, 1583.14],
  s380Qp: [295.3, 345.5, 421.51, 505.81, 531.1, 584.21, 730.26, 803.29, 1004.11, 1757.19],
  s450Qc: [306.42, 358.51, 437.38, 524.86, 551.1, 606.21, 757.76, 833.54, 1041.93, 1823.38],
  s450Qp: [340.14, 397.96, 485.51, 582.61, 611.74, 672.91, 841.14, 925.25, 1156.56, 2023.98],
  s750R1Qp: [411.91, 481.93, 587.95, 705.54, 740.82, 814.9, 1018.63, 1120.49, 1400.61, 2451.07],
  s750R2Qp: [416.02, 486.74, 593.82, 712.58, 748.21, 823.03, 1028.79, 1131.67, 1414.59, 2475.53],
  s750R3Qp: [449.29, 525.67, 641.32, 769.58, 808.06, 888.87, 1111.09, 1222.2, 1527.75, 2673.56],
};

const selecionadaPartialTodosLivre = {
  s380Qc: [317.92, 371.97, 453.8, 544.56, 571.79, 628.97, 786.21, 864.83, 1081.04, 1891.82],
  s380Qp: [352.9, 412.89, 503.73, 604.48, 634.7, 698.17, 872.71, 959.98, 1199.98, 2099.97],
  s450Qc: [366.18, 428.43, 522.68, 627.22, 658.58, 724.44, 905.55, 996.11, 1245.14, 2179.0],
  s450Qp: [406.47, 475.57, 580.2, 696.24, 731.05, 804.16, 1005.2, 1105.72, 1382.15, 2418.76],
  s750R1Qp: [492.25, 575.93, 702.63, 843.16, 885.32, 973.85, 1217.31, 1339.04, 1673.8, 2929.15],
  s750R2Qp: [497.15, 581.67, 709.64, 851.57, 894.15, 983.57, 1229.46, 1352.41, 1690.51, 2958.39],
  s750R3Qp: [536.91, 628.18, 766.38, 919.66, 965.64, 1062.2, 1327.75, 1460.53, 1825.66, 3194.91],
};

const AMIL_SCENARIOS = {
  nao_mei: {
    total: {
      '2 vidas': amilTotalNaoMeiBase,
      '3 a 4 vidas': amilTotalNaoMeiBase,
      '5 a 29 vidas': amilTotalNaoMei529,
    },
    parcial: {
      '2 vidas': amilPartialNaoMeiBase,
      '3 a 4 vidas': amilPartialNaoMeiBase,
      '5 a 29 vidas': amilPartialNaoMei529,
    },
  },
  mei: {
    total: {
      '2 vidas': amilTotalMeiBase,
      '3 a 4 vidas': amilTotalMeiBase,
      '5 a 29 vidas': amilTotalMei529,
    },
    parcial: {
      '2 vidas': amilPartialMeiBase,
      '3 a 4 vidas': amilPartialMeiBase,
      '5 a 29 vidas': amilPartialMei529,
    },
  },
  todos: {
    total: {
      '30 a 99 vidas - Compulsorio': amilTotalTodosCompulsorio,
      '30 a 99 vidas - Livre Adesao': amilTotalTodosLivre,
    },
    parcial: {
      '30 a 99 vidas - Compulsorio': amilPartialTodosCompulsorio,
      '30 a 99 vidas - Livre Adesao': amilPartialTodosLivre,
    },
  },
};

const SELECIONADA_SCENARIOS = {
  nao_mei: {
    total: {
      '2 vidas': selecionadaTotalNaoMeiBase,
      '3 a 4 vidas': selecionadaTotalNaoMeiBase,
      '5 a 29 vidas': selecionadaTotalNaoMei529,
    },
    parcial: {
      '2 vidas': selecionadaPartialNaoMeiBase,
      '3 a 4 vidas': selecionadaPartialNaoMeiBase,
      '5 a 29 vidas': selecionadaPartialNaoMei529,
    },
  },
  mei: {
    total: {
      '2 vidas': selecionadaTotalMeiBase,
      '3 a 4 vidas': selecionadaTotalMeiBase,
      '5 a 29 vidas': selecionadaTotalMei529,
    },
    parcial: {
      '2 vidas': selecionadaPartialMeiBase,
      '3 a 4 vidas': selecionadaPartialMeiBase,
      '5 a 29 vidas': selecionadaPartialMei529,
    },
  },
  todos: {
    total: {
      '30 a 99 vidas - Compulsorio': selecionadaTotalTodosCompulsorio,
      '30 a 99 vidas - Livre Adesao': selecionadaTotalTodosLivre,
    },
    parcial: {
      '30 a 99 vidas - Compulsorio': selecionadaPartialTodosCompulsorio,
      '30 a 99 vidas - Livre Adesao': selecionadaPartialTodosLivre,
    },
  },
};

const normalizeText = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const buildProductItems = (lineName, productDefinitions, scenarios) =>
  Object.entries(productDefinitions).map(([productName, productDefinition]) => ({
    operadora: 'Amil',
    linha: lineName,
    produto: productName,
    modalidadeBase: 'PME',
    abrangencia: productDefinition.abrangencia,
    acomodacoes: productDefinition.acomodacoes,
    tabelas: buildTablesForProduct(productDefinition, scenarios),
  }));

const buildTablesForProduct = (productDefinition, scenarios) => {
  const tables = [];

  for (const [perfilEmpresarial, profiles] of Object.entries(scenarios)) {
    for (const [coparticipacao, ranges] of Object.entries(profiles)) {
      for (const [rangeLabel, matrix] of Object.entries(ranges)) {
        const pricesByAcomodacao = Object.fromEntries(
          Object.entries(productDefinition.columns).map(([acomodacao, key]) => [acomodacao, buildPriceRow(matrix[key])]),
        );

        tables.push({
          nome: buildTableName(perfilEmpresarial, coparticipacao, rangeLabel),
          modalidade: 'PME',
          perfilEmpresarial,
          coparticipacao,
          vidasMin: rangeToBounds(rangeLabel).min,
          vidasMax: rangeToBounds(rangeLabel).max,
          precosPorAcomodacao: pricesByAcomodacao,
        });
      }
    }
  }

  return tables;
};

const rangeToBounds = (rangeLabel) => {
  if (rangeLabel === '2 vidas') return { min: 2, max: 2 };
  if (rangeLabel === '3 a 4 vidas') return { min: 3, max: 4 };
  if (rangeLabel === '5 a 29 vidas') return { min: 5, max: 29 };
  if (rangeLabel.includes('30 a 99 vidas')) return { min: 30, max: 99 };
  throw new Error(`Faixa de vidas desconhecida: ${rangeLabel}`);
};

const buildTableName = (perfilEmpresarial, coparticipacao, rangeLabel) => {
  const copartLabel = coparticipacao === 'total' ? 'Copart 30%' : 'Copart Parcial';

  if (perfilEmpresarial === 'mei') {
    return `PME MEI ${copartLabel} - ${rangeLabel}`;
  }

  if (perfilEmpresarial === 'nao_mei') {
    return `PME Nao MEI ${copartLabel} - ${rangeLabel}`;
  }

  return `PME ${copartLabel} - ${rangeLabel}`;
};

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'PDF reajuste Amil 2026-04-06',
  items: [
    ...buildProductItems('Linha Amil', AMIL_PRODUCTS, AMIL_SCENARIOS),
    ...buildProductItems('Linha Selecionada', SELECIONADA_PRODUCTS, SELECIONADA_SCENARIOS),
  ],
};

const { data: currentProducts, error: productsError } = await supabase
  .from('cotador_produtos')
  .select('id,nome,linha_id,abrangencia,acomodacao');

if (productsError) {
  throw productsError;
}

const { data: currentLines, error: linesError } = await supabase
  .from('cotador_linhas_produto')
  .select('id,nome');

if (linesError) {
  throw linesError;
}

const lineIdByName = new Map(currentLines.map((line) => [normalizeText(line.nome), line.id]));

for (const item of payload.items) {
  const lineId = lineIdByName.get(normalizeText(item.linha));
  const product = currentProducts.find((candidate) => candidate.linha_id === lineId && normalizeText(candidate.nome) === normalizeText(item.produto));
  if (!product) {
    throw new Error(`Produto nao encontrado no catalogo atual: ${item.linha} / ${item.produto}`);
  }
}

fs.mkdirSync(cotadorJsonDir, { recursive: true });

const outputPath = path.resolve(cotadorJsonDir, 'amil-reajuste-tabelas-2026-04-06.json');
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Arquivo gerado em: ${outputPath}`);
