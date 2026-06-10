export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Política de Privacidad
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Última actualización: Abril 2025
        </p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            1. Información que recopilamos
          </h2>
          <p className="text-gray-600 mb-2">
            QRPass recopila la siguiente información:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Datos de contacto (nombre, email, teléfono)</li>
            <li>Información de la organización (barrio, club, gimnasio, etc.)</li>
            <li>Datos de uso de la plataforma</li>
            <li>Mensajes enviados a través de nuestro chatbot de Instagram</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            2. Uso de la información
          </h2>
          <p className="text-gray-600 mb-2">
            Utilizamos la información para:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Proveer el servicio de gestión de accesos con QR</li>
            <li>Responder consultas a través de nuestro chatbot</li>
            <li>Mejorar nuestros servicios</li>
            <li>Enviar notificaciones relevantes</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            3. Protección de datos
          </h2>
          <p className="text-gray-600">
            Implementamos medidas de seguridad para proteger tu información. 
            Los datos se almacenan en servidores seguros y solo el personal 
            autorizado tiene acceso a ellos.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            4. Contacto
          </h2>
          <p className="text-gray-600">
            Para consultas sobre esta política, contactanos a través de nuestro 
            chatbot en Instagram @qrpass_oficial o por email.
          </p>
        </section>
      </div>
    </div>
  );
}
