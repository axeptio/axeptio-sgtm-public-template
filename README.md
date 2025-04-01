<h1>
  <img src="https://axeptio.imgix.net/2024/07/e444a7b2-ea3d-4471-a91c-6be23e0c3cbb.png" alt="Descrizione immagine" width="80" style="vertical-align: middle; margin-right: 10px;" />
  Axeptio sGTM Public Template
</h1>
<br>

This repository provides a template for integrating **Axeptio** as a **Consent Management Platform (CMP)** tag within **Google Tag Manager (GTM)** Server-Side. The primary goal of this template is to streamline the deployment, configuration, and management of consent mechanisms across websites, ensuring full compliance with data protection regulations like GDPR and ePrivacy.

<br>

## 📑 Table of Contents

1. [About Axeptio](#about-axeptio)
2. [Key Features of Axeptio](#key-features-of-axeptio)
3. [Benefits of Using sGTM with Axeptio](#benefits-of-using-sgtm-with-axeptio)
4. [How to Import and Use the Template in GTM Server-Side](#how-to-import-and-use-the-template-in-gtm-server-side)
   - [Step 1: Import the Template into GTM Server-Side](#step-1-import-the-template-into-gtm-server-side)
   - [Step 2: Configure the Tag](#step-2-configure-the-tag)
   - [Step 3: Test the Configuration](#step-3-test-the-configuration)
5. [Troubleshooting and Support](#troubleshooting-and-support)


<br><br>

## 🍪About Axeptio
[Axeptio](https://www.axept.io/) is a highly configurable **Consent Management Platform (CMP)** that enables websites to collect, manage, and store user consent data in a **transparent** and **privacy-first** manner. It is designed to facilitate compliance with global data privacy laws such as **GDPR** and the **ePrivacy Directive**. Axeptio allows users to customize consent forms and manage user preferences with ease while offering a seamless experience across web environments.
<br><br>
## Key Features of Axeptio
- **Full compliance** with GDPR and the ePrivacy Directive.
- **Customizable and intuitive** interface for users, ensuring flexibility in implementation.
- **Seamless integration** with existing cookie management tools.
- **Dynamic script management**, enabling scripts to load based on user consent status.

<br><br> 

## Benefits of Using sGTM with Axeptio
By leveraging **GTM Server-Side** (sGTM) with Axeptio, organizations can enhance the consent management process with multiple key benefits:

- **Prolonged Cookie Lifespan**: Cookies can be securely managed and extended on the server side, reducing the restrictions imposed by client-side limitations such as cookie expiration or privacy controls.
- **Enhanced Data Security**: Server-side tagging minimizes the exposure of sensitive data on the client side, offering added protection for user consent and other personal data.
- **Improved Performance**: Offloading tag management to the server reduces the load on the client side, resulting in faster page loads and a more optimized user experience.
- **Better Control and Compliance** Server-side management of user consent data ensures that you have full control over the flow of data between your website and third-party services, minimizing risks related to privacy breaches.
<br><br>

## 🛠How to Import and Use the Template in GTM Server-Side
Follow these steps to integrate the **Axeptio sGTM** template with your **GTM Server-Side** container:
### Step 1: Import the Template into GTM Server-Side
1. Clone or download this repository to your local machine.
2. Open your **GTM Server-Side** container in **Google Tag Manager**.
3. Navigate to the **Templates** section.
4. Click on **Import** and upload the **JSON** file for the **Axeptio sGTM tag template**.
### Step 2: Configure the Tag
1. After the template has been imported, go to the **Tags** section in your GTM Server-Side container.
2. Click on **New Tag**, and then select the Axeptio sGTM template you just imported.
3. Configure the tag settings:
- **Project ID**: Enter your unique **Axeptio Project ID**.
- **Cookie Version**: Define the version of the cookies managed by Axeptio.
4. Define the **Triggers** that will fire the Axeptio tag based on user interactions. For example, you may want to trigger it based on user consent acceptance.

### Step 3: Test the Configuration
1. Use the **Preview** tool in GTM Server-Side to test the tag's integration and functionality.
2. Verify that user consent is correctly collected and transmitted securely from the server side.
3. Ensure that cookies are extended, consent data is stored, and scripts are dynamically loaded based on user consent preferences.
<br><br>
## Troubleshooting and Support🧑‍💻
If you encounter any issues during the installation or configuration of the **Axeptio sGTM tag**, please consult the following resources:

- [Official Axeptio Documentation](https://www.axept.io/)
- [Google Tag Manager Server-Side Documentation](https://developers.google.com/tag-platform/tag-manager/server-side)

<br>

Axeptio helps you provide a better user experience while ensuring compliance with data protection laws. If you have any questions or suggestions for improving this template, feel free to open an issue or submit a pull request.
