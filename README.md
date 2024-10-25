
# Axeptio sGTM Public Template

This repository contains a template for implementing the Axeptio CMP (Consent Management Platform) as a tag in Google Tag Manager (GTM) Server-Side. This sGTM tag is designed to facilitate the deployment and management of consent on websites while ensuring compliance with data privacy regulations.

## About Axeptio

[Axeptio](https://www.axept.io) is a Consent Management Platform (CMP) that ensures websites are compliant with GDPR and ePrivacy regulations. It provides a user-friendly interface to collect, manage, and store user consents in a transparent and privacy-first approach.

### Key Features of Axeptio:
- Full compliance with GDPR and ePrivacy.
- Intuitive, customizable user interface.
- Seamless integration with cookie management tools.
- Dynamic script management based on user consent.

## Benefits of Using sGTM with Axeptio

By using GTM Server-Side (sGTM) with Axeptio, you can extend and optimize cookie duration while maintaining user privacy. Server-side tagging allows you to:
- **Prolong Cookie Lifespan**: Cookies can be securely extended on the server side, ensuring they last longer without being affected by browser-side limitations.
- **Enhanced Data Security**: Server-side tags reduce the exposure of sensitive data on the client-side, adding a layer of security to consent management.
- **Improved Performance**: Offloading tagging operations to the server can result in faster load times and a more streamlined user experience.
- **Better Control**: Manage the flow of user consent and data between your website and third-party services, all handled securely through your server.

## How to Import and Use the Template in GTM Server-Side

### Step 1: Import the Template into GTM Server-Side
1. Clone or download this repository.
2. Open your GTM Server-Side container in Google Tag Manager.
3. Navigate to the **Templates** section and click on **Import**.
4. Upload the JSON file for the Axeptio sGTM tag template.

### Step 2: Configure the Tag
1. Once imported, go to the **Tags** section in your GTM Server-Side.
2. Create a new tag and select the Axeptio sGTM template.
3. Define the triggers that will fire the Axeptio tag based on user interactions.

### Step 3: Test the Configuration
1. Use GTM Server-Side's **Preview** tool to test the integration.
2. Ensure that the consent collection and cookie extension functions work as expected and that data is securely transmitted server-side.

## More Information

For detailed instructions on configuring Axeptio, please refer to the [official documentation](https://www.axept.io/docs).

### Useful Links:
- [Axeptio - Consent Management](https://www.axept.io)
- [GTM Server-Side Documentation](https://developers.google.com/tag-manager/serverside)

---

Axeptio helps you provide a better user experience while ensuring compliance with data protection laws. If you have any questions or suggestions for improving this template, feel free to open an issue or submit a pull request.
