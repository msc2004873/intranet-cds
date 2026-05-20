export async function GET(request) {
  try {
    const hoy = new Date();
    const dia = hoy.getDate();

    let periodoNum = 1;
    if (dia <= 5) periodoNum = 1;
    else if (dia <= 10) periodoNum = 2;
    else if (dia <= 15) periodoNum = 3;
    else if (dia <= 20) periodoNum = 4;
    else if (dia <= 25) periodoNum = 5;
    else periodoNum = 6;

    const tipoCambio = 475;

    const esPrimerDia =
      (periodoNum === 1 && dia === 1) ||
      (periodoNum === 2 && dia === 6) ||
      (periodoNum === 3 && dia === 11) ||
      (periodoNum === 4 && dia === 16) ||
      (periodoNum === 5 && dia === 21) ||
      (periodoNum === 6 && dia === 26);

    return Response.json({
      periodo: periodoNum,
      tipoCambio,
      esPrimerDia,
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
