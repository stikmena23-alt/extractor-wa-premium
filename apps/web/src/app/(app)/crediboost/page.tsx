import Link from "next/link";

export default function CrediboostPage() {
  return (
    <div className="page crediboost-page">
      <header className="page-header">
        <h1>CrediBoost</h1>
        <p>Recarga tus créditos y mantén activa toda la suite de WF Tools sin interrupciones.</p>
      </header>
      <section className="crediboost-content">
        <article>
          <h2>¿Cómo funciona?</h2>
          <ol>
            <li>Selecciona el paquete de créditos que necesitas.</li>
            <li>Confirma el pago con nuestro equipo de soporte.</li>
            <li>La recarga se aplica automáticamente a tu cuenta en segundos.</li>
          </ol>
        </article>
        <article>
          <h2>Contacta a soporte</h2>
          <p>
            Escríbenos directamente a través de <Link href="https://wa.me/573224070563">WhatsApp</Link> o envía un
            correo a <a href="mailto:soporte@wftools.com">soporte@wftools.com</a> indicando tu usuario.
          </p>
          <p>Atendemos en horario extendido para que nunca te quedes sin saldo.</p>
        </article>
      </section>
    </div>
  );
}
